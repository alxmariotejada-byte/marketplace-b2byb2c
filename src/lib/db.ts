import "server-only";
import { Pool, PoolClient, types } from "pg";
import { SCHEMA_SQL } from "./schema";
import { importRows } from "./catalog-import";
import { parseRows } from "./catalog-parser";
import catalogo from "../../data/catalogo.json";

// NUMERIC y COUNT llegan como texto desde Postgres: los convertimos a número.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

declare global {
  var __logimktPool: Pool | undefined;
  var __logimktReady: Promise<void> | undefined;
}

function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL (cadena de conexión de Neon).");
  if (!globalThis.__logimktPool) {
    globalThis.__logimktPool = new Pool({ connectionString: url, max: 5 });
  }
  return globalThis.__logimktPool;
}

async function init() {
  const p = pool();
  try {
    await p.query(SCHEMA_SQL);
  } catch (e) {
    // Si dos instancias crean las tablas a la vez, una puede fallar: lo ignoramos.
    const code = (e as { code?: string }).code;
    if (code !== "23505" && code !== "42P07") throw e;
  }
  // Carga inicial automática del catálogo de 500 productos si la tabla está vacía.
  const { rows } = await p.query("SELECT COUNT(*)::int AS n FROM products");
  if (rows[0].n === 0) {
    const parsed = parseRows(catalogo.header, catalogo.rows);
    await withClient((c) => importRows(c, parsed.rows, "CARGA_INICIAL"));
  }
}

export function ready(): Promise<void> {
  if (!globalThis.__logimktReady) {
    globalThis.__logimktReady = init().catch((e) => {
      globalThis.__logimktReady = undefined;
      throw e;
    });
  }
  return globalThis.__logimktReady;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const r = await pool().query(text, params);
  return r.rows as T[];
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Ejecuta varias consultas dentro de una transacción (todo o nada). */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  return withClient(fn);
}
