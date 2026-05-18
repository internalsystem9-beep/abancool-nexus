const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const config = require("../config");
const { sendMail, otpEmailTemplate } = require("./mailer");

/**
 * OTP service — generate, store (hashed), verify, with attempt limits + cooldown.
 * Purposes: 'login' (2FA), 'signup', 'reset'.
 */

function generateCode(length = config.otp.length) {
  // Cryptographically strong numeric code, zero-padded.
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, "0");
}

async function purgeExpired() {
  await db.query("DELETE FROM otp_codes WHERE expires_at < NOW()");
}

async function canResend(email, purpose) {
  const rows = await db.query(
    `SELECT created_at FROM otp_codes
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );
  if (!rows.length) return { ok: true };
  const last = new Date(rows[0].created_at).getTime();
  const elapsed = (Date.now() - last) / 1000;
  if (elapsed < config.otp.resendCooldownSeconds) {
    return { ok: false, retryAfter: Math.ceil(config.otp.resendCooldownSeconds - elapsed) };
  }
  return { ok: true };
}

async function issueOtp({ email, purpose = "login", userId = null }) {
  await purgeExpired();

  const cooldown = await canResend(email, purpose);
  if (!cooldown.ok) {
    const err = new Error(`Please wait ${cooldown.retryAfter}s before requesting another code`);
    err.status = 429;
    throw err;
  }

  // Invalidate any prior unconsumed codes for this (email, purpose)
  await db.query(
    `UPDATE otp_codes SET consumed_at = NOW()
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
    [email, purpose]
  );

  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const expires = new Date(Date.now() + config.otp.ttlMinutes * 60_000);

  await db.query(
    `INSERT INTO otp_codes (user_id, email, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, email, purpose, hash, expires]
  );

  const tpl = otpEmailTemplate({ code, ttlMinutes: config.otp.ttlMinutes, appName: config.appName });
  await sendMail({ to: email, ...tpl });

  return {
    sent: true,
    expiresAt: expires.toISOString(),
    ttlSeconds: config.otp.ttlMinutes * 60,
    // Only returned when OTP_DEV_RETURN=true. NEVER enable in production.
    ...(config.otp.devReturn ? { devCode: code } : {}),
  };
}

async function verifyOtp({ email, code, purpose = "login" }) {
  await purgeExpired();

  const rows = await db.query(
    `SELECT id, code_hash, attempts, expires_at, consumed_at
     FROM otp_codes
     WHERE email = ? AND purpose = ?
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );
  if (!rows.length) {
    const err = new Error("No verification code requested"); err.status = 400; throw err;
  }
  const row = rows[0];
  if (row.consumed_at) {
    const err = new Error("Code already used"); err.status = 400; throw err;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error("Code expired"); err.status = 400; throw err;
  }
  if (row.attempts >= config.otp.maxAttempts) {
    await db.query("UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?", [row.id]);
    const err = new Error("Too many attempts — request a new code"); err.status = 429; throw err;
  }

  const ok = await bcrypt.compare(String(code), row.code_hash);
  if (!ok) {
    await db.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    const err = new Error("Invalid code"); err.status = 400; throw err;
  }

  await db.query("UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?", [row.id]);
  return { verified: true };
}

module.exports = { issueOtp, verifyOtp };
