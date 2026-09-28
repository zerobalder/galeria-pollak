// Utilidades compartidas por las funciones del panel.
import { createPool } from "@vercel/postgres";

function connString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

// Pool perezoso: se crea en la primera consulta, no al importar el módulo.
// Así, si la base aún no está configurada, /api/obras puede responder [] sin romperse.
let _pool = null;
function getPool() {
  if (!_pool) {
    const cs = connString();
    _pool = createPool(cs ? { connectionString: cs } : undefined);
  }
  return _pool;
}
export const pool = {
  sql: (strings, ...values) => getPool().sql(strings, ...values),
  query: (...args) => getPool().query(...args),
};

// Verifica la contraseña compartida (header x-admin-key vs env ADMIN_PASSWORD).
export function authOK(req) {
  const key = req.headers["x-admin-key"] || "";
  const pass = process.env.ADMIN_PASSWORD || "";
  return Boolean(pass) && key === pass;
}

// Crea la tabla si no existe.
export async function ensureSchema() {
  await pool.sql`CREATE TABLE IF NOT EXISTS obras (
    slug        TEXT PRIMARY KEY,
    catalogo    INTEGER NOT NULL DEFAULT 0,
    titulo      TEXT NOT NULL,
    anio        INTEGER,
    categoria   TEXT,
    tematica    TEXT,
    tecnica     TEXT,
    medidas     TEXT,
    descripcion TEXT,
    texto       TEXT,
    imagen      TEXT,
    thumb       TEXT,
    destacada   BOOLEAN DEFAULT false,
    vendido     BOOLEAN DEFAULT false,
    creado      TIMESTAMPTZ DEFAULT now(),
    actualizado TIMESTAMPTZ DEFAULT now()
  )`;
}

// Fila de la base -> objeto "obra" tal como lo consume app.js.
export function rowToObra(r) {
  return {
    id: r.slug,
    titulo: r.titulo,
    anio: r.anio,
    categoria: r.categoria,
    tematica: r.tematica,
    tecnica: r.tecnica,
    medidas: r.medidas || "",
    imagen: r.imagen,
    thumb: r.thumb || null,
    destacada: !!r.destacada,
    vendido: !!r.vendido,
    descripcion: r.descripcion || "",
    texto: r.texto || "",
  };
}

// Lee el cuerpo JSON de la petición (compatible con o sin body-parser).
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// nº de catálogo a partir del slug ("1232-desierto..." -> 1232)
export const catalogoDe = (slug) => parseInt(String(slug), 10) || 0;

// slug seguro: "Río entre rocas" -> "rio-entre-rocas"
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
