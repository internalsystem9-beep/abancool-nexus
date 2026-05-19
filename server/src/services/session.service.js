const crypto = require("crypto");
const db = require("../config/db");
const config = require("../config");

/**
 * Session Service
 * Handles session creation, tracking, device fingerprinting, and invalidation
 */

/**
 * Generate device fingerprint from request
 */
function generateDeviceFingerprint(req) {
  const userAgent = req.headers["user-agent"] || "";
  const acceptLanguage = req.headers["accept-language"] || "";
  const acceptEncoding = req.headers["accept-encoding"] || "";

  const fingerprint = crypto
    .createHash("sha256")
    .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}`)
    .digest("hex");

  return fingerprint;
}

/**
 * Get client IP address from request
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Create a new session
 */
async function createSession(userId, req, expiresIn = config.jwt.expiresIn) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const deviceFingerprint = generateDeviceFingerprint(req);

  // Generate token hash (we don't store the actual token)
  const tokenHash = crypto.randomBytes(32).toString("hex");

  // Parse expiration time
  let expiresAt = new Date();
  if (typeof expiresIn === "string") {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      const [, value, unit] = match;
      const ms = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
      }[unit];
      expiresAt.setTime(expiresAt.getTime() + parseInt(value) * ms);
    }
  } else {
    expiresAt.setTime(expiresAt.getTime() + expiresIn);
  }

  const result = await db.query(
    `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, device_fingerprint, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, tokenHash, ipAddress, userAgent, deviceFingerprint, expiresAt]
  );

  return {
    sessionId: result.insertId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Validate session exists and is not expired
 */
async function validateSession(userId, tokenHash) {
  const rows = await db.query(
    `SELECT id, expires_at FROM sessions
     WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()`,
    [userId, tokenHash]
  );

  if (!rows.length) {
    return { valid: false };
  }

  return { valid: true, sessionId: rows[0].id };
}

/**
 * Invalidate a session (logout)
 */
async function invalidateSession(sessionId) {
  await db.query(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  return { invalidated: true };
}

/**
 * Invalidate all sessions for a user
 */
async function invalidateAllUserSessions(userId) {
  const result = await db.query(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  return { invalidated: true, count: result.affectedRows };
}

/**
 * Get active sessions for a user
 */
async function getUserSessions(userId) {
  const rows = await db.query(
    `SELECT id, ip_address, user_agent, device_fingerprint, created_at, expires_at
     FROM sessions
     WHERE user_id = ? AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    sessionId: row.id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    deviceFingerprint: row.device_fingerprint,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  const result = await db.query(`DELETE FROM sessions WHERE expires_at < NOW()`);
  return { cleaned: true, count: result.affectedRows };
}

module.exports = {
  generateDeviceFingerprint,
  getClientIp,
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  getUserSessions,
  cleanupExpiredSessions,
};
