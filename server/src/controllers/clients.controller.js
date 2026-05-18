const db = require("../config/db");
const { z } = require("zod");

const clientSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

async function list(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, name, email, phone, company, notes, created_at FROM clients ORDER BY created_at DESC LIMIT 200"
    );
    res.json({ clients: rows });
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const rows = await db.query("SELECT * FROM clients WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ client: rows[0] });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = clientSchema.parse(req.body);
    const result = await db.query(
      "INSERT INTO clients (name, email, phone, company, notes) VALUES (?, ?, ?, ?, ?)",
      [data.name, data.email ?? null, data.phone ?? null, data.company ?? null, data.notes ?? null]
    );
    res.status(201).json({ client: { id: result.insertId, ...data } });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = clientSchema.parse(req.body);
    await db.query(
      "UPDATE clients SET name=?, email=?, phone=?, company=?, notes=? WHERE id=?",
      [data.name, data.email ?? null, data.phone ?? null, data.company ?? null, data.notes ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await db.query("DELETE FROM clients WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, remove };
