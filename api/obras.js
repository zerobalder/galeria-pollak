// GET público: devuelve todas las obras ordenadas (más actual primero).
// Si la base aún no está configurada o vacía, devuelve [] y la web usa data.js.
import { pool, ensureSchema, rowToObra } from "./_lib.js";

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const { rows } = await pool.sql`SELECT * FROM obras ORDER BY catalogo DESC, slug DESC`;
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=60");
    res.status(200).json(rows.map(rowToObra));
  } catch (e) {
    // Sin credenciales / sin tabla -> respaldo estático en el cliente.
    res.status(200).json([]);
  }
}
