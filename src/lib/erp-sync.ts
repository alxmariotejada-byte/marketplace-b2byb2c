import "server-only";
import { query, tx } from "./db";
import { erpCatalog, erpConfig, erpCreateOrder, erpGetOrder, ErpError } from "./erp";

async function log(kind: string, ok: boolean, detail: string) {
  await query("INSERT INTO erp_sync_log (kind, ok, detail) VALUES ($1,$2,$3)", [kind, ok, detail.slice(0, 2000)]);
}

/**
 * ERP → Tienda: trae el catálogo publicado del ERP y actualiza, por SKU, el id del ERP,
 * los precios, el stock disponible y si el producto está publicado.
 */
export async function syncCatalogFromErp() {
  const cfg = erpConfig("catalogo");
  if (!cfg) throw new ErpError("La conexión con el ERP no está configurada.");
  try {
    const items = await erpCatalog(cfg);
    const rows = items.map((p) => ({
      sku: p.sku,
      erp_id: p.id,
      name: p.nombre,
      price_b2c: p.precioB2C,
      price_b2b: p.precioB2B ?? null,
      stock: p.disponible,
      image_url: p.imagenUrl?.trim() || null,
      active: (p.estaPublicado ?? true) && (p.estadoProducto ?? "Activo") === "Activo",
    }));
    const res = await tx(async (c) => {
      const r = await c.query<{ sku: string }>(
        `UPDATE products p SET
           erp_id = x.erp_id,
           price_b2c = COALESCE(NULLIF(x.price_b2c, 0), p.price_b2c),
           price_b2b = COALESCE(NULLIF(x.price_b2b, 0), p.price_b2b),
           stock = COALESCE(x.stock, p.stock),
           image_url = COALESCE(x.image_url, p.image_url),
           status = CASE WHEN x.active THEN 'Activo' ELSE 'Inactivo' END,
           erp_synced_at = now(), updated_at = now()
         FROM jsonb_to_recordset($1::jsonb) AS x(sku text, erp_id text, name text, price_b2c numeric, price_b2b numeric, stock int, image_url text, active boolean)
         WHERE p.sku = x.sku
         RETURNING p.sku`,
        [JSON.stringify(rows)],
      );
      return r.rows.length;
    });
    const withStock = rows.filter((r) => r.stock !== null).length;
    const detail = `ERP: ${items.length} productos publicados. Vinculados por SKU: ${res}. ` +
      (withStock ? `Stock actualizado en ${withStock}.` : "Este usuario del ERP no ve cantidades de stock (solo un Admin las ve; configura ERP_ADMIN_EMAIL), se conservó el stock local.");
    await log("catalogo", true, detail);
    return { erpProducts: items.length, linked: res, withStock, detail };
  } catch (e) {
    await log("catalogo", false, (e as Error).message);
    throw e;
  }
}

/** Tienda → OMS del ERP: envía un pedido ya creado en la tienda. No bloquea la compra si el ERP falla. */
export async function pushOrderToErp(code: string) {
  const cfg = erpConfig();
  if (!cfg) return { skipped: true as const };
  const [order] = await query<{ id: number; erp_order_id: string | null }>(
    "SELECT id, erp_order_id FROM orders WHERE code = $1", [code],
  );
  if (!order || order.erp_order_id) return { skipped: true as const };
  const items = await query<{ sku: string; qty: number; erp_id: string | null }>(
    `SELECT i.sku, i.qty, p.erp_id FROM order_items i JOIN products p ON p.sku = i.sku
     WHERE i.order_id = $1 AND i.qty > 0`, [order.id],
  );
  const missing = items.filter((i) => !i.erp_id).map((i) => i.sku);
  try {
    if (missing.length) throw new ErpError(`Estos SKU no existen en el ERP (sincroniza el catálogo): ${missing.join(", ")}`);
    const r = await erpCreateOrder(cfg, items.map((i) => ({ erpId: i.erp_id!, qty: i.qty })), `LOGIMKT-${code}`);
    let number: string | null = null;
    let status: string | null = "Creada";
    try {
      const o = await erpGetOrder(cfg, r.id);
      number = o.numeroOrden;
      status = o.estado;
    } catch {}
    await query("UPDATE orders SET erp_order_id=$1, erp_order_number=$2, erp_status=$3, erp_error=NULL WHERE id=$4", [
      r.id, number, status, order.id,
    ]);
    await query("INSERT INTO order_events (order_id,status,note) VALUES ($1,'Confirmado',$2)", [
      order.id, `Pedido registrado en el OMS del ERP${number ? ` como ${number}` : ""}. Stock reservado en el ERP.`,
    ]);
    await log("pedido", true, `${code} → ERP ${number ?? r.id}`);
    return { ok: true as const, erpId: r.id, number };
  } catch (e) {
    const msg = (e as Error).message;
    await query("UPDATE orders SET erp_error=$1 WHERE id=$2", [msg, order.id]);
    await log("pedido", false, `${code}: ${msg}`);
    return { ok: false as const, error: msg };
  }
}

/** Consulta el estado actual del pedido en el ERP (para la página de seguimiento). */
export async function refreshErpOrder(code: string) {
  const cfg = erpConfig();
  if (!cfg) return null;
  const [o] = await query<{ id: number; erp_order_id: string | null }>("SELECT id, erp_order_id FROM orders WHERE code=$1", [code]);
  if (!o?.erp_order_id) return null;
  try {
    const r = await erpGetOrder(cfg, o.erp_order_id);
    await query("UPDATE orders SET erp_status=$1, erp_order_number=$2 WHERE id=$3", [r.estado, r.numeroOrden, o.id]);
    return r;
  } catch {
    return null;
  }
}
