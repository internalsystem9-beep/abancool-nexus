const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const config = require("../config");
const { sendMail } = require("./mailer");

/**
 * Password Reset Service
 * Handles password reset token generation, validation, and password updates
 */

/**
 * Generate a password reset token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Request password reset
 * Generates a reset token and sends email
 */
async function requestPasswordReset(email) {
  const rows = await db.query(`SELECT id, first_name FROM users WHERE email = ?`, [email]);

  if (!rows.length) {
    // Don't reveal if email exists (security best practice)
    return { sent: true };
  }

  const user = rows[0];
  const resetToken = generateResetToken();
  const tokenHash = await bcrypt.hash(resetToken, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store reset token
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
    [user.id, tokenHash, expiresAt]
  );

  // Send reset email
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
  const subject = `${config.appName} - Password Reset Request`;
  const text = `Hi ${user.first_name || "User"},\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't request this, ignore this email.`;
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;max-width:480px;margin:auto">
    <div style="font-size:13px;letter-spacing:.2em;color:#00B2FF;text-transform:uppercase">${config.appName}</div>
    <h1 style="margin:8px 0 16px;font-size:22px">Reset your password</h1>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6">Hi ${user.first_name || "User"},</p>
    <p style="color:#a1a1aa;font-size:14px;line-height:1.6">Click the button below to reset your password. This link expires in 24 hours.</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#00B2FF;color:#000;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a>
    </div>
    <p style="color:#71717a;font-size:12px">If you didn't request this, please ignore this email or contact support.</p>
  </div>`;

  await sendMail({ to: email, subject, text, html });

  return { sent: true };
}

/**
 * Validate password reset token
 */
async function validateResetToken(userId, resetToken) {
  const rows = await db.query(
    `SELECT id, token_hash, expires_at FROM password_reset_tokens
     WHERE user_id = ? AND expires_at > NOW()`,
    [userId]
  );

  if (!rows.length) {
    const err = new Error("Invalid or expired reset token");
    err.status = 400;
    throw err;
  }

  const row = rows[0];
  const isValid = await bcrypt.compare(resetToken, row.token_hash);

  if (!isValid) {
    const err = new Error("Invalid or expired reset token");
    err.status = 400;
    throw err;
  }

  return { valid: true };
}

/**
 * Reset password with token
 */
async function resetPassword(userId, resetToken, newPassword) {
  // Validate token
  await validateResetToken(userId, resetToken);

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

  // Update password
  await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);

  // Invalidate reset token
  await db.query(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);

  // Invalidate all sessions (force re-login)
  await db.query(`DELETE FROM sessions WHERE user_id = ?`, [userId]);

  return { reset: true };
}

/**
 * Change password (authenticated user)
 */
async function changePassword(userId, currentPassword, newPassword) {
  const rows = await db.query(`SELECT password_hash FROM users WHERE id = ?`, [userId]);

  if (!rows.length) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const user = rows[0];
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValid) {
    const err = new Error("Current password is incorrect");
    err.status = 401;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);

  return { changed: true };
}

/**
 * Clean up expired reset tokens
 */
async function cleanupExpiredTokens() {
  const result = await db.query(`DELETE FROM password_reset_tokens WHERE expires_at < NOW()`);
  return { cleaned: true, count: result.affectedRows };
}

module.exports = {
  generateResetToken,
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  changePassword,
  cleanupExpiredTokens,
};
