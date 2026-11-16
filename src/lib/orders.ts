import "server-only";
import type { PoolClient } from "pg";
import { query, tx } from "./db";
import {
  B2B_MIN_ORDER, B2C_FREE_SHIPPING_FROM, B2C_MIN_ORDER, B2C_SHIPPING, PAYMENT_METHODS, type Channel,
} from "./shared";

export type OrderInput = {
  channel: Channel;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company?: string;
  tax_id?: string;
  address: string;
  city: string;
  payment_method: string;
  items: { sku: string; qty: number }[];
};

export class OrderError extends Error {}

const CARRIERS = ["C807 Xpress", "Urbano Express", "DHL El Salvador", "Correos de El Salvador"];

/** Días prometidos de entrega según el canal. */
const PROMISE_DAYS: Record<Channel, number> = { B2C: 3, B2B: 5 };

function paymentStatus(method: string): string {
  switch (method) {
    case "tarjeta": return "Pagado";
    case "transferencia": return "Pendiente de verificación";
    case "contra_entrega": return "Se cobra al entregar";
    case "credito_30": return "Crédito 30 días";
    default: return "Pendiente";
  }
}

async function addEvent(c: PoolClient, orderId: number, status: string, note: string) {
  await c.query("INSERT INTO order_events (order_id,status,note) VALUES ($1,$2,$3)", [orderId, status, note]);
}

/**
 * Flujo del pedido (Marketplace → OMS → ERP):
 * 1. Valida datos del cliente y reglas B2B/B2C.
 * 2. Bloquea los productos y verifica stock en tiempo real.
 * 3. Reserva (descuenta) inventario y registra el movimiento en el ERP.
 * 4. Crea el pedido en estado Recibido → Confirmado.
 */
export async function createOrder(input: OrderInput) {
  const channel: Channel = input.channel === "B2B" ? "B2B" : "B2C";
  const req = (v: string | undefined, label: string) => {
    if (!v || !v.trim()) throw new OrderError(`Falta: ${label}`);
    return v.trim();
  };
  const name = req(input.customer_name, "nombre");
  const email = req(input.customer_email, "correo");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new OrderError("El correo no es válido");
  const address = req(input.address, "dirección");
  const city = req(input.city, "ciudad");
  const company = channel === "B2B" ? req(input.company, "nombre de la empresa") : null;
  const taxId = channel === "B2B" ? req(input.tax_id, "NIT o NRC de la empresa") : null;
  if (!PAYMENT_METHODS[channel].some((m) => m.id === input.payment_method))
    throw new OrderError("Método de pago no válido para este tipo de cliente");

  const wanted = new Map<string, number>();
  for (const it of input.items ?? []) {
    const q = Math.floor(Number(it.qty));
    if (!it.sku || !Number.isFinite(q) || q <= 0) continue;
    wanted.set(it.sku, (wanted.get(it.sku) ?? 0) + Math.min(q, 10000));
  }
  if (!wanted.size) throw new OrderError("El carrito está vacío");

  return tx(async (c) => {
    // Bloqueo de filas: evita vender el mismo stock dos veces si llegan pedidos simultáneos.
    const { rows: products } = await c.query<{
      sku: string; name: string; price_b2c: number; price_b2b: number; stock: number; weight_kg: number | null; status: string;
    }>(
      "SELECT sku,name,price_b2c,price_b2b,stock,weight_kg,status FROM products WHERE sku = ANY($1) ORDER BY sku FOR UPDATE",
      [[...wanted.keys()]],
    );
    const lines = products
      .filter((p) => p.status === "Activo")
      .map((p) => {
        const requested = wanted.get(p.sku)!;
        const qty = Math.min(requested, p.stock); // si no hay suficiente, se surte lo disponible (afecta el Fill Rate)
        const price = channel === "B2B" ? p.price_b2b : p.price_b2c;
        return { ...p, requested, qty, price, total: Math.round(qty * price * 100) / 100 };
      });
    const sendable = lines.filter((l) => l.qty > 0);
    if (!sendable.length) throw new OrderError("Los productos del carrito no tienen stock disponible");

    const subtotal = Math.round(sendable.reduce((s, l) => s + l.total, 0) * 100) / 100;
    if (channel === "B2B" && subtotal < B2B_MIN_ORDER)
      throw new OrderError(`La compra mínima B2B es de $${B2B_MIN_ORDER}. Tu subtotal disponible es $${subtotal.toFixed(2)}.`);
    if (channel === "B2C" && subtotal < B2C_MIN_ORDER)
      throw new OrderError(`La compra mínima es de $${B2C_MIN_ORDER}.`);

    const weight = sendable.reduce((s, l) => s + (l.weight_kg ?? 0.5) * l.qty, 0);
    const shipping = channel === "B2C" && subtotal < B2C_FREE_SHIPPING_FROM ? B2C_SHIPPING : 0;
    // Costo logístico interno estimado: base por pedido + costo por kg transportado.
    const logisticsCost = Math.round((2 + 0.25 * weight) * 100) / 100;

    const { rows: [order] } = await c.query<{ id: number }>(
      `INSERT INTO orders (channel,customer_name,customer_email,customer_phone,company,tax_id,address,city,
         payment_method,payment_status,subtotal,shipping_charge,total,logistics_cost,total_weight_kg,status,promised_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Confirmado', now() + ($16 || ' days')::interval)
       RETURNING id`,
      [channel, name, email, input.customer_phone?.trim() || null, company, taxId, address, city,
       input.payment_method, paymentStatus(input.payment_method), subtotal, shipping, subtotal + shipping,
       logisticsCost, weight, String(PROMISE_DAYS[channel])],
    );
    const code = `LMK-${String(order.id).padStart(6, "0")}`;
    await c.query("UPDATE orders SET code=$1 WHERE id=$2", [code, order.id]);

    for (const l of lines) {
      await c.query(
        "INSERT INTO order_items (order_id,sku,name,qty_requested,qty,unit_price,line_total) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [order.id, l.sku, l.name, l.requested, l.qty, l.price, l.total],
      );
      if (l.qty > 0) {
        await c.query("UPDATE products SET stock = stock - $1, updated_at=now() WHERE sku=$2", [l.qty, l.sku]);
        await c.query("INSERT INTO inventory_movements (sku,type,qty,reference) VALUES ($1,'SALIDA_VENTA',$2,$3)", [
          l.sku, -l.qty, code,
        ]);
      }
    }
    const partial = lines.some((l) => l.qty < l.requested) || lines.length < wanted.size;
    await addEvent(c, order.id, "Recibido", "Pedido recibido desde el Marketplace. Notificación enviada al cliente.");
    await addEvent(
      c, order.id, "Confirmado",
      partial
        ? "Stock verificado: algunos productos se surtieron parcialmente por falta de inventario. Inventario reservado en el ERP."
        : "Stock verificado y reservado en el ERP.",
    );
    return { code, partial };
  });
}

const NEXT: Record<string, string> = {
  Confirmado: "En preparación",
  "En preparación": "Enviado",
  Enviado: "Entregado",
  Entregado: "Cerrado",
};

export function nextStatus(status: string): string | null {
  return NEXT[status] ?? null;
}

/** Avanza el pedido al siguiente estado del flujo OMS. */
export async function advanceOrder(code: string) {
  return tx(async (c) => {
    const { rows: [o] } = await c.query<{ id: number; status: string }>(
      "SELECT id,status FROM orders WHERE code=$1 FOR UPDATE", [code],
    );
    if (!o) throw new OrderError("Pedido no encontrado");
    const next = NEXT[o.status];
    if (!next) throw new OrderError(`El pedido está en "${o.status}" y no puede avanzar`);
    let note = "Notificación enviada al cliente.";
    if (next === "En preparación") {
      note = "Orden de preparación generada para el almacén (picking y empaque). " + note;
      await c.query("UPDATE orders SET status=$1 WHERE id=$2", [next, o.id]);
    } else if (next === "Enviado") {
      const carrier = CARRIERS[o.id % CARRIERS.length];
      const tracking = `GE${Date.now().toString().slice(-8)}${o.id}`;
      note = `Transportista asignado: ${carrier}. Guía de envío ${tracking}. ` + note;
      await c.query("UPDATE orders SET status=$1, carrier=$2, tracking=$3, shipped_at=now() WHERE id=$4", [
        next, carrier, tracking, o.id,
      ]);
    } else if (next === "Entregado") {
      note = "Entrega registrada. KPI OTIF actualizado. Encuesta de satisfacción enviada al cliente.";
      await c.query(
        `UPDATE orders SET status=$1, delivered_at=now(),
           payment_status = CASE WHEN payment_method IN ('contra_entrega','transferencia') THEN 'Pagado' ELSE payment_status END
         WHERE id=$2`,
        [next, o.id],
      );
    } else {
      note = "Pedido cerrado.";
      await c.query("UPDATE orders SET status=$1 WHERE id=$2", [next, o.id]);
    }
    await addEvent(c, o.id, next, note);
    return next;
  });
}

async function restock(c: PoolClient, orderId: number, code: string, type: string) {
  const { rows } = await c.query<{ sku: string; qty: number }>(
    "SELECT sku, qty FROM order_items WHERE order_id=$1 AND qty > 0", [orderId],
  );
  for (const it of rows) {
    await c.query("UPDATE products SET stock = stock + $1, updated_at=now() WHERE sku=$2", [it.qty, it.sku]);
    await c.query("INSERT INTO inventory_movements (sku,type,qty,reference) VALUES ($1,$2,$3,$4)", [
      it.sku, type, it.qty, code,
    ]);
  }
}

export async function cancelOrder(code: string) {
  return tx(async (c) => {
    const { rows: [o] } = await c.query<{ id: number; status: string }>(
      "SELECT id,status FROM orders WHERE code=$1 FOR UPDATE", [code],
    );
    if (!o) throw new OrderError("Pedido no encontrado");
    if (!["Recibido", "Confirmado", "En preparación"].includes(o.status))
      throw new OrderError("Solo se pueden cancelar pedidos que aún no se han enviado");
    await restock(c, o.id, code, "ENTRADA_CANCELACION");
    await c.query("UPDATE orders SET status='Cancelado' WHERE id=$1", [o.id]);
    await addEvent(c, o.id, "Cancelado", "Pedido cancelado. Inventario liberado en el ERP. Notificación enviada al cliente.");
  });
}

export async function returnOrder(code: string, reason: string) {
  return tx(async (c) => {
    const { rows: [o] } = await c.query<{ id: number; status: string; payment_method: string }>(
      "SELECT id,status,payment_method FROM orders WHERE code=$1 FOR UPDATE", [code],
    );
    if (!o) throw new OrderError("Pedido no encontrado");
    if (!["Entregado", "Cerrado"].includes(o.status))
      throw new OrderError("Solo se pueden devolver pedidos entregados");
    await restock(c, o.id, code, "ENTRADA_DEVOLUCION");
    await c.query("UPDATE orders SET status='Devuelto', return_reason=$1, payment_status='Reembolsado' WHERE id=$2", [
      reason || "Sin motivo", o.id,
    ]);
    await addEvent(c, o.id, "Devuelto", `Devolución registrada (${reason || "sin motivo"}). Mercancía reingresada al inventario y reembolso emitido.`);
  });
}

export type OrderRow = {
  id: number; code: string; channel: Channel; customer_name: string; customer_email: string; customer_phone: string | null;
  company: string | null; tax_id: string | null; address: string; city: string; payment_method: string; payment_status: string;
  subtotal: number; shipping_charge: number; total: number; logistics_cost: number; status: string; carrier: string | null;
  tracking: string | null; promised_at: Date; shipped_at: Date | null; delivered_at: Date | null; return_reason: string | null;
  nps_score: number | null; created_at: Date;
};

export async function getOrder(code: string) {
  const [order] = await query<OrderRow>("SELECT * FROM orders WHERE code=$1", [code]);
  if (!order) return null;
  const items = await query<{ sku: string; name: string; qty_requested: number; qty: number; unit_price: number; line_total: number }>(
    "SELECT sku,name,qty_requested,qty,unit_price,line_total FROM order_items WHERE order_id=$1 ORDER BY id", [order.id],
  );
  const events = await query<{ status: string; note: string | null; created_at: Date }>(
    "SELECT status,note,created_at FROM order_events WHERE order_id=$1 ORDER BY id", [order.id],
  );
  return { order, items, events };
}
