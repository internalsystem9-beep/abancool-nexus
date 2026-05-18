const { z } = require("zod");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const config = require("../config");
const { signToken } = require("../middleware/auth");
const otpService = require("../services/otp.service");

const emailSchema = z.object({ email: z.string().email().max(255) });
const verifySchema = z.object({
  email: z.string().email().max(255),
  code: z.string().min(4).max(10).regex(/^\d+$/),
  purpose: z.enum(["login", "signup", "reset"]).default("login"),
});

/**
 * Step 1 of secure sign-in:
 *   client posts { email, password } → server validates → issues OTP → returns { otpRequired:true }
 * Step 2:
 *   client posts { email, code } to /auth/verify-otp → returns { user, token }
 */

async function loginInit(req, res, next) {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const rows = await db.query(
      "SELECT id, name, email, password_hash, role, two_factor_enabled FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Always require OTP for login (2FA-by-default). Toggle per-user via two_factor_enabled if desired.
    const result = await otpService.issueOtp({ email, purpose: "login", userId: user.id });
    res.json({
      otpRequired: true,
      email,
      expiresAt: result.expiresAt,
      ttlSeconds: result.ttlSeconds,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) { next(err); }
}

async function verifyLoginOtp(req, res, next) {
  try {
    const { email, code } = verifySchema.parse({ ...req.body, purpose: "login" });
    await otpService.verifyOtp({ email, code, purpose: "login" });

    const rows = await db.query(
      "SELECT id, name, email, role FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ user, token });
  } catch (err) { next(err); }
}

async function resendOtp(req, res, next) {
  try {
    const { email } = emailSchema.parse(req.body);
    const purpose = (req.body.purpose || "login");
    const rows = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    const userId = rows[0]?.id ?? null;
    const result = await otpService.issueOtp({ email, purpose, userId });
    res.json({
      sent: true,
      expiresAt: result.expiresAt,
      ttlSeconds: result.ttlSeconds,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) { next(err); }
}

module.exports = { loginInit, verifyLoginOtp, resendOtp };
