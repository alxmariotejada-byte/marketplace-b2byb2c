import "server-only";
import { randomUUID } from "node:crypto";

/**
 * Conexión con el ERP/OMS de LOGIMKT (API .NET de Marcelo Zepeda, repositorio Marzza01/ERP-Log-stica-).
 *
 * Variables de entorno:
 *   ERP_API_URL   URL base de la API, p. ej. https://marketplaceerp-api.onrender.com
 *   ERP_EMAIL / ERP_PASSWORD              usuario del ERP con rol Comprador: crea los pedidos en el OMS
 *   ERP_ADMIN_EMAIL / ERP_ADMIN_PASSWORD  (opcional) usuario Admin: el catálogo trae también stock y precio B2B
 *
 * Si no están definidas, la tienda funciona sola con su propio inventario.
 */

export type ErpConfig = { url: string; email: string; password: string };

/** "pedidos" usa el usuario Comprador; "catalogo" prefiere el Admin (ve stock) y si no hay, usa el Comprador. */
export function erpConfig(kind: "pedidos" | "catalogo" = "pedidos"): ErpConfig | null {
  const url = process.env.ERP_API_URL?.trim().replace(/\/+$/, "");
  const admin = process.env.ERP_ADMIN_EMAIL?.trim() && process.env.ERP_ADMIN_PASSWORD;
  const email = (kind === "catalogo" && admin ? process.env.ERP_ADMIN_EMAIL : process.env.ERP_EMAIL)?.trim();
  const password = kind === "catalogo" && admin ? process.env.ERP_ADMIN_PASSWORD : process.env.ERP_PASSWORD;
  if (!url || !email || !password) return null;
  return { url, email, password };
}

export class ErpError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

type Session = { token: string; role: string; expires: number };
declare global {
  var __erpSessions: Map<string, Session> | undefined;
}
const sessions = () => (globalThis.__erpSessions ??= new Map());

const TIMEOUT_MS = 60_000; // Render puede tardar en "despertar" el servicio gratuito.

async function call<T>(cfg: ErpConfig, path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(cfg.url + path, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new ErpError(`No se pudo contactar al ERP (${(e as Error).message}).`);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && ("mensaje" in data ? String(data.mensaje) : "tipo" in data ? String(data.tipo) : "")) ||
      `HTTP ${res.status}`;
    throw new ErpError(`El ERP respondió: ${msg}`, res.status);
  }
  return data as T;
}

/** Inicia sesión en el ERP y guarda el token mientras sea válido. */
export async function erpLogin(cfg: ErpConfig, force = false) {
  const s = sessions().get(cfg.email);
  if (!force && s && s.expires > Date.now() + 60_000) return s;
  const r = await call<{ token: string; role?: string; rol?: string; expiresAt?: string }>(cfg, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
  });
  const expires = r.expiresAt ? Date.parse(r.expiresAt) : Date.now() + 30 * 60_000;
  const session: Session = { token: r.token, role: r.role ?? r.rol ?? "", expires };
  sessions().set(cfg.email, session);
  return session;
}

async function authed<T>(cfg: ErpConfig, path: string, init: RequestInit = {}): Promise<T> {
  const s = await erpLogin(cfg);
  try {
    return await call<T>(cfg, path, init, s.token);
  } catch (e) {
    if (e instanceof ErpError && e.status === 401) {
      const fresh = await erpLogin(cfg, true);
      return call<T>(cfg, path, init, fresh.token);
    }
    throw e;
  }
}

/* ---------- Catálogo ---------- */

type ErpStock = { cantidadTotal?: number; cantidadReservada?: number; cantidadBloqueada?: number; cantidadDisponible?: number };
export type ErpProduct = {
  id: string;
  sku: string;
  nombre: string;
  precioB2C: number;
  precioB2B?: number;
  estadoProducto?: string;
  estaPublicado?: boolean;
  disponibilidad?: boolean;
  imagenUrl?: string | null;
  stock?: ErpStock | null;
  stocks?: ErpStock[];
};

function available(p: ErpProduct): number | null {
  const list = p.stocks?.length ? p.stocks : p.stock ? [p.stock] : [];
  if (!list.length) return null;
  return list.reduce((sum, s) => {
    const d = s.cantidadDisponible ?? (s.cantidadTotal ?? 0) - (s.cantidadReservada ?? 0) - (s.cantidadBloqueada ?? 0);
    return sum + Math.max(0, d);
  }, 0);
}

/** Descarga el catálogo publicado del ERP (todas las páginas). */
export async function erpCatalog(cfg: ErpConfig) {
  const out: (ErpProduct & { disponible: number | null })[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await authed<{ total: number; items: ErpProduct[] }>(cfg, `/api/productos?pagina=${page}&tamano=500&orden=sku`);
    for (const p of r.items ?? []) out.push({ ...p, disponible: available(p) });
    if (!r.items?.length || out.length >= r.total) break;
  }
  return out;
}

/* ---------- Pedidos (OMS) ---------- */

/**
 * Crea el pedido en el OMS del ERP con el checkout multi-SKU (rol Comprador).
 * El ERP reserva el stock, calcula precio e IVA y procesa el pago en su pasarela.
 */
export async function erpCreateOrder(cfg: ErpConfig, items: { erpId: string; qty: number }[], key: string = randomUUID()) {
  const r = await authed<{ ordenId?: string; OrdenId?: string; transaccionId?: string }>(cfg, "/api/checkout/v2/comprar", {
    method: "POST",
    headers: { "Idempotency-Key": key.replace(/[^A-Za-z0-9_-]/g, "") },
    body: JSON.stringify({ items: items.map((i) => ({ productoId: i.erpId, cantidad: i.qty })) }),
  });
  const id = r.ordenId ?? r.OrdenId;
  if (!id) throw new ErpError("El ERP no devolvió el número de orden.");
  return { id, transaction: r.transaccionId ?? null };
}

export type ErpOrder = {
  id: string;
  numeroOrden: string;
  estado: string;
  montoTotal: number;
  transportista?: string;
  guiaEnvio?: string;
  fechaEntregaEstimada?: string | null;
  fechaEntregaReal?: string | null;
};

export async function erpGetOrder(cfg: ErpConfig, id: string) {
  return authed<ErpOrder>(cfg, `/api/ordenes/${encodeURIComponent(id)}`);
}

/** Prueba rápida de conexión para el panel de administración. */
export async function erpPing(cfg: ErpConfig) {
  const s = await erpLogin(cfg, true);
  const r = await authed<{ total: number }>(cfg, "/api/productos?pagina=1&tamano=1");
  return { role: s.role, products: r.total };
}
