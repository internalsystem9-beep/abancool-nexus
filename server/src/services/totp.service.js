const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const db = require("../config/db");
const config = require("../config");

/**
 * TOTP 2FA Service
 * Handles TOTP secret generation, QR code generation, and verification
 */

/**
 * Generate a new TOTP secret for a user
 * Returns secret and QR code data URL
 */
async function generateTotpSecret(email, appName = config.appName) {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${email})`,
    issuer: appName,
    length: 32,
  });

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrCode,
    otpauthUrl: secret.otpauth_url,
    backupCodes: generateBackupCodes(10),
  };
}

/**
 * Generate backup codes for account recovery
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Verify a TOTP token
 */
function verifyTotpToken(secret, token, window = 2) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token),
    window,
  });
}

/**
 * Enable 2FA for a user
 * Stores the TOTP secret and backup codes
 */
async function enableTwoFactor(userId, totpSecret, backupCodes) {
  // Store TOTP secret in users table
  await db.query(
    `UPDATE users SET totp_secret = ?, totp_enabled = TRUE WHERE id = ?`,
    [totpSecret, userId]
  );

  // Store backup codes (hashed) in a backup_codes table
  // For now, we'll store them as JSON in a separate table
  const backupCodesJson = JSON.stringify(backupCodes);
  await db.query(
    `INSERT INTO backup_codes (user_id, codes_json, created_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE codes_json = VALUES(codes_json), created_at = NOW()`,
    [userId, backupCodesJson]
  );

  return { enabled: true };
}

/**
 * Disable 2FA for a user
 */
async function disableTwoFactor(userId) {
  await db.query(
    `UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = ?`,
    [userId]
  );

  await db.query(`DELETE FROM backup_codes WHERE user_id = ?`, [userId]);

  return { disabled: true };
}

/**
 * Get user's TOTP secret
 */
async function getUserTotpSecret(userId) {
  const rows = await db.query(
    `SELECT totp_secret, totp_enabled FROM users WHERE id = ?`,
    [userId]
  );

  if (!rows.length) {
    throw new Error("User not found");
  }

  return {
    secret: rows[0].totp_secret,
    enabled: rows[0].totp_enabled,
  };
}

/**
 * Verify TOTP token for a user
 */
async function verifyUserTotpToken(userId, token) {
  const { secret, enabled } = await getUserTotpSecret(userId);

  if (!enabled || !secret) {
    throw new Error("2FA not enabled for this user");
  }

  const isValid = verifyTotpToken(secret, token);
  if (!isValid) {
    throw new Error("Invalid TOTP token");
  }

  return { verified: true };
}

/**
 * Use a backup code (one-time use)
 */
async function useBackupCode(userId, code) {
  const rows = await db.query(
    `SELECT codes_json FROM backup_codes WHERE user_id = ?`,
    [userId]
  );

  if (!rows.length) {
    throw new Error("No backup codes found");
  }

  const codes = JSON.parse(rows[0].codes_json);
  const index = codes.indexOf(code);

  if (index === -1) {
    throw new Error("Invalid backup code");
  }

  // Remove used code
  codes.splice(index, 1);
  await db.query(
    `UPDATE backup_codes SET codes_json = ? WHERE user_id = ?`,
    [JSON.stringify(codes), userId]
  );

  return { used: true, remainingCodes: codes.length };
}

module.exports = {
  generateTotpSecret,
  generateBackupCodes,
  verifyTotpToken,
  enableTwoFactor,
  disableTwoFactor,
  getUserTotpSecret,
  verifyUserTotpToken,
  useBackupCode,
};
