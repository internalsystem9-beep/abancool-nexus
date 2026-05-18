const bcrypt = require("bcryptjs");
const { z } = require("zod");
const db = require("../config/db");
const config = require("../config");
const { signToken } = require("../middleware/auth");

const signupSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function signup(req, res, next) {
  try {
    const { name, email, password } = signupSchema.parse(req.body);

    const existing = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const result = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, "admin"]
    );

    const user = { id: result.insertId, name, email, role: "admin" };
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const rows = await db.query(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // NOTE: For OTP-protected sign-in, prefer POST /api/auth/login-init + /api/auth/verify-otp.
    // This endpoint is retained for service tokens / non-2FA clients.
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, me };
