// POST protegido por contraseña: alta / edición / borrado / migración de obras.
// Acciones: ping | seed | create | update | flag | delete
import { pool, ensureSchema, rowToObra, authOK, readJson, catalogoDe, slugify } from "./_lib.js";
import { put, del } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "método no permitido" });
  if (!authOK(req)) return res.status(401).json({ error: "no autorizado" });

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(400).json({ error: "JSON inválido" });
  }

  try {
    await ensureSchema();
    switch (body.action) {
      case "ping":   return res.status(200).json({ ok: true });
      case "seed":   return await seed(body, res);
      case "create": return await upsert(body, res, true);
      case "update": return await upsert(body, res, false);
      case "flag":   return await flag(body, res);
      case "delete": return await remove(body, res);
      default:       return res.status(400).json({ error: "acción desconocida" });
    }
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}

// Migración única del catálogo estático (data.js) a la base. No pisa lo ya existente.
async function seed(body, res) {
  const items = Array.isArray(body.obras) ? body.obras : [];
  let n = 0;
  for (const o of items) {
    const slug = o.id || o.slug;
    if (!slug) continue;
    await pool.sql`INSERT INTO obras
      (slug,catalogo,titulo,anio,categoria,tematica,tecnica,medidas,descripcion,texto,imagen,thumb,destacada,vendido)
      VALUES (${slug},${catalogoDe(slug)},${o.titulo || ""},${o.anio ?? null},${o.categoria || ""},
              ${o.tematica || ""},${o.tecnica || ""},${o.medidas || ""},${o.descripcion || ""},${o.texto || ""},
              ${o.imagen || ""},${o.thumb || null},${!!o.destacada},${!!o.vendido})
      ON CONFLICT (slug) DO NOTHING`;
    n++;
  }
  const { rows } = await pool.sql`SELECT count(*)::int AS total FROM obras`;
  return res.status(200).json({ ok: true, procesadas: n, total: rows[0].total });
}

// Sube una imagen (base64) a Vercel Blob y devuelve su URL pública.
async function subir(path, b64) {
  const r = await put(path, Buffer.from(b64, "base64"), {
    access: "public",
    contentType: "image/jpeg",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  return r.url;
}

async function upsert(body, res, isCreate) {
  const catalogo = parseInt(body.catalogo, 10) || catalogoDe(body.slug) || 0;
  let slug = body.slug;
  if (isCreate && !slug) slug = `${catalogo}-${slugify(body.titulo)}`;
  if (!slug) return res.status(400).json({ error: "falta identificador (slug)" });

  let imagen = body.imagen || null;
  let thumb = body.thumb || null;
  if (body.fullB64) imagen = await subir(`obras/${slug}.jpg`, body.fullB64);
  if (body.thumbB64) thumb = await subir(`obras/thumb/${slug}.jpg`, body.thumbB64);

  if (isCreate) {
    if (!imagen) return res.status(400).json({ error: "falta la imagen" });
    await pool.sql`INSERT INTO obras
      (slug,catalogo,titulo,anio,categoria,tematica,tecnica,medidas,descripcion,texto,imagen,thumb,destacada,vendido)
      VALUES (${slug},${catalogo},${body.titulo || ""},${body.anio ?? null},${body.categoria || ""},
              ${body.tematica || ""},${body.tecnica || ""},${body.medidas || ""},${body.descripcion || ""},${body.texto || ""},
              ${imagen},${thumb},${!!body.destacada},${!!body.vendido})
      ON CONFLICT (slug) DO UPDATE SET
        catalogo=EXCLUDED.catalogo, titulo=EXCLUDED.titulo, anio=EXCLUDED.anio, categoria=EXCLUDED.categoria,
        tematica=EXCLUDED.tematica, tecnica=EXCLUDED.tecnica, medidas=EXCLUDED.medidas, descripcion=EXCLUDED.descripcion,
        texto=EXCLUDED.texto, imagen=EXCLUDED.imagen, thumb=EXCLUDED.thumb, destacada=EXCLUDED.destacada,
        vendido=EXCLUDED.vendido, actualizado=now()`;
  } else {
    await pool.sql`UPDATE obras SET
      catalogo=${catalogo}, titulo=${body.titulo || ""}, anio=${body.anio ?? null}, categoria=${body.categoria || ""},
      tematica=${body.tematica || ""}, tecnica=${body.tecnica || ""}, medidas=${body.medidas || ""},
      descripcion=${body.descripcion || ""}, texto=${body.texto || ""},
      imagen=COALESCE(${imagen}, imagen), thumb=COALESCE(${thumb}, thumb),
      destacada=${!!body.destacada}, vendido=${!!body.vendido}, actualizado=now()
      WHERE slug=${slug}`;
  }

  const { rows } = await pool.sql`SELECT * FROM obras WHERE slug=${slug}`;
  return res.status(200).json({ ok: true, obra: rows[0] ? rowToObra(rows[0]) : null });
}

// Cambio rápido de un flag (vendido / destacada) sin reenviar toda la obra.
async function flag(body, res) {
  const slug = body.slug;
  const val = !!body.value;
  if (!slug) return res.status(400).json({ error: "falta slug" });
  if (body.field === "vendido") {
    await pool.sql`UPDATE obras SET vendido=${val}, actualizado=now() WHERE slug=${slug}`;
  } else if (body.field === "destacada") {
    await pool.sql`UPDATE obras SET destacada=${val}, actualizado=now() WHERE slug=${slug}`;
  } else {
    return res.status(400).json({ error: "campo inválido" });
  }
  return res.status(200).json({ ok: true });
}

async function remove(body, res) {
  const slug = body.slug;
  if (!slug) return res.status(400).json({ error: "falta slug" });
  const { rows } = await pool.sql`SELECT imagen, thumb FROM obras WHERE slug=${slug}`;
  await pool.sql`DELETE FROM obras WHERE slug=${slug}`;
  // Borra los archivos de Blob (solo si estaban alojados ahí, no los del repo).
  for (const u of [rows[0]?.imagen, rows[0]?.thumb]) {
    if (u && /blob\.vercel-storage\.com/.test(u)) {
      try { await del(u); } catch (e) { /* ignora */ }
    }
  }
  return res.status(200).json({ ok: true });
}
