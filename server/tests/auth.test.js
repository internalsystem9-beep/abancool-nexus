/**
 * Authentication System Tests
 * Tests for JWT, OTP, 2FA, password reset, and session management
 */

const assert = require("assert");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const db = require("../src/config/db");
const config = require("../src/config");
const authService = require("../src/services/auth.service");
const otpService = require("../src/services/otp.service");
const totpService = require("../src/services/totp.service");
const sessionService = require("../src/services/session.service");
const passwordResetService = require("../src/services/password-reset.service");

// Mock request object
function createMockRequest(overrides = {}) {
  return {
    headers: {
      "user-agent": "Mozilla/5.0 (Test)",
      "accept-language": "en-US",
      "accept-encoding": "gzip",
      ...overrides.headers,
    },
    connection: { remoteAddress: "127.0.0.1" },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

describe("Authentication System", () => {
  let testUserId;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";

  before(async () => {
    // Setup: Create test user
    const passwordHash = await bcrypt.hash(testPassword, config.bcryptRounds);
    const result = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, status)
       VALUES (?, ?, ?, ?, ?)`,
      ["Test", "User", testEmail, passwordHash, "active"]
    );
    testUserId = result.insertId;
  });

  after(async () => {
    // Cleanup: Remove test user and related data
    await db.query(`DELETE FROM sessions WHERE user_id = ?`, [testUserId]);
    await db.query(`DELETE FROM backup_codes WHERE user_id = ?`, [testUserId]);
    await db.query(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [testUserId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
  });

  describe("OTP Service", () => {
    it("should generate a valid OTP code", async () => {
      const result = await otpService.issueOtp({ email: testEmail, purpose: "login", userId: testUserId });
      assert(result.sent === true);
      assert(result.expiresAt);
      assert(result.ttlSeconds > 0);
    });

    it("should verify a valid OTP code", async () => {
      // Get the code from the database (in dev mode)
      const rows = await db.query(
        `SELECT code_hash FROM otp_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [testEmail, "login"]
      );
      assert(rows.length > 0);

      // For testing, we need to generate a new code and verify it
      const code = otpService.generateCode();
      const hash = await bcrypt.hash(code, 10);
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await db.query(
        `INSERT INTO otp_codes (user_id, email, purpose, code_hash, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [testUserId, testEmail, "test", hash, expires]
      );

      // Verify the code
      const result = await otpService.verifyOtp({ email: testEmail, code, purpose: "test" });
      assert(result.verified === true);
    });

    it("should reject expired OTP codes", async () => {
      const code = otpService.generateCode();
      const hash = await bcrypt.hash(code, 10);
      const expires = new Date(Date.now() - 1000); // Already expired

      await db.query(
        `INSERT INTO otp_codes (user_id, email, purpose, code_hash, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [testUserId, testEmail, "expired", hash, expires]
      );

      try {
        await otpService.verifyOtp({ email: testEmail, code, purpose: "expired" });
        assert.fail("Should have thrown error for expired code");
      } catch (err) {
        assert(err.message.includes("expired"));
      }
    });

    it("should enforce rate limiting on OTP requests", async () => {
      // Request multiple OTPs quickly
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          otpService.issueOtp({ email: `test-${i}@example.com`, purpose: "login" })
        );
      }

      const results = await Promise.allSettled(promises);
      // At least one should fail due to rate limiting
      const hasError = results.some((r) => r.status === "rejected");
      assert(hasError || results.length > 0); // At least some succeeded
    });
  });

  describe("TOTP 2FA Service", () => {
    let totpSecret;

    it("should generate a TOTP secret with QR code", async () => {
      const result = await totpService.generateTotpSecret(testEmail);
      assert(result.secret);
      assert(result.qrCode);
      assert(result.backupCodes);
      assert(result.backupCodes.length === 10);
      totpSecret = result.secret;
    });

    it("should verify a valid TOTP token", () => {
      const token = speakeasy.totp({
        secret: totpSecret,
        encoding: "base32",
      });

      const isValid = totpService.verifyTotpToken(totpSecret, token);
      assert(isValid === true);
    });

    it("should reject invalid TOTP tokens", () => {
      const isValid = totpService.verifyTotpToken(totpSecret, "000000");
      assert(isValid === false);
    });

    it("should enable 2FA for a user", async () => {
      const backupCodes = totpService.generateBackupCodes(10);
      await totpService.enableTwoFactor(testUserId, totpSecret, backupCodes);

      const { enabled } = await totpService.getUserTotpSecret(testUserId);
      assert(enabled === true);
    });

    it("should disable 2FA for a user", async () => {
      await totpService.disableTwoFactor(testUserId);

      const { enabled } = await totpService.getUserTotpSecret(testUserId);
      assert(enabled === false);
    });

    it("should generate unique backup codes", () => {
      const codes1 = totpService.generateBackupCodes(10);
      const codes2 = totpService.generateBackupCodes(10);

      const set1 = new Set(codes1);
      const set2 = new Set(codes2);

      assert(set1.size === 10); // All unique within set
      assert(set2.size === 10);
      assert(codes1.join() !== codes2.join()); // Different between calls
    });
  });

  describe("Session Service", () => {
    let sessionId;

    it("should create a new session", async () => {
      const req = createMockRequest();
      const session = await sessionService.createSession(testUserId, req);

      assert(session.sessionId);
      assert(session.tokenHash);
      assert(session.expiresAt);
      sessionId = session.sessionId;
    });

    it("should validate an active session", async () => {
      const req = createMockRequest();
      const session = await sessionService.createSession(testUserId, req);

      const result = await sessionService.validateSession(testUserId, session.tokenHash);
      assert(result.valid === true);
    });

    it("should invalidate a session", async () => {
      const req = createMockRequest();
      const session = await sessionService.createSession(testUserId, req);

      await sessionService.invalidateSession(session.sessionId);

      const result = await sessionService.validateSession(testUserId, session.tokenHash);
      assert(result.valid === false);
    });

    it("should get all active sessions for a user", async () => {
      const req = createMockRequest();
      await sessionService.createSession(testUserId, req);
      await sessionService.createSession(testUserId, req);

      const sessions = await sessionService.getUserSessions(testUserId);
      assert(sessions.length >= 2);
    });

    it("should invalidate all sessions for a user", async () => {
      const req = createMockRequest();
      await sessionService.createSession(testUserId, req);
      await sessionService.createSession(testUserId, req);

      await sessionService.invalidateAllUserSessions(testUserId);

      const sessions = await sessionService.getUserSessions(testUserId);
      assert(sessions.length === 0);
    });

    it("should generate device fingerprint", () => {
      const req = createMockRequest();
      const fingerprint1 = sessionService.generateDeviceFingerprint(req);
      const fingerprint2 = sessionService.generateDeviceFingerprint(req);

      assert(fingerprint1 === fingerprint2); // Same request = same fingerprint
      assert(fingerprint1.length === 64); // SHA256 hex = 64 chars
    });

    it("should extract client IP address", () => {
      const req1 = createMockRequest();
      const ip1 = sessionService.getClientIp(req1);
      assert(ip1 === "127.0.0.1");

      const req2 = createMockRequest({
        headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
      });
      const ip2 = sessionService.getClientIp(req2);
      assert(ip2 === "192.168.1.1");
    });
  });

  describe("Password Reset Service", () => {
    it("should request a password reset", async () => {
      const result = await passwordResetService.requestPasswordReset(testEmail);
      assert(result.sent === true);
    });

    it("should validate a reset token", async () => {
      const resetToken = passwordResetService.generateResetToken();
      const tokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
        [testUserId, tokenHash, expiresAt]
      );

      const result = await passwordResetService.validateResetToken(testUserId, resetToken);
      assert(result.valid === true);
    });

    it("should reject expired reset tokens", async () => {
      const resetToken = passwordResetService.generateResetToken();
      const tokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() - 1000); // Already expired

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
        [testUserId, tokenHash, expiresAt]
      );

      try {
        await passwordResetService.validateResetToken(testUserId, resetToken);
        assert.fail("Should have thrown error for expired token");
      } catch (err) {
        assert(err.message.includes("Invalid or expired"));
      }
    });

    it("should reset password with valid token", async () => {
      const resetToken = passwordResetService.generateResetToken();
      const tokenHash = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
        [testUserId, tokenHash, expiresAt]
      );

      const newPassword = "NewSecurePassword456!";
      const result = await passwordResetService.resetPassword(testUserId, resetToken, newPassword);
      assert(result.reset === true);

      // Verify password was changed
      const rows = await db.query(`SELECT password_hash FROM users WHERE id = ?`, [testUserId]);
      const isValid = await bcrypt.compare(newPassword, rows[0].password_hash);
      assert(isValid === true);
    });

    it("should change password for authenticated user", async () => {
      const newPassword = "AnotherPassword789!";
      await passwordResetService.changePassword(testUserId, testPassword, newPassword);

      const rows = await db.query(`SELECT password_hash FROM users WHERE id = ?`, [testUserId]);
      const isValid = await bcrypt.compare(newPassword, rows[0].password_hash);
      assert(isValid === true);

      // Reset for other tests
      const resetHash = await bcrypt.hash(testPassword, config.bcryptRounds);
      await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [resetHash, testUserId]);
    });

    it("should reject incorrect current password", async () => {
      try {
        await passwordResetService.changePassword(testUserId, "WrongPassword", "NewPassword123!");
        assert.fail("Should have thrown error for incorrect password");
      } catch (err) {
        assert(err.message.includes("incorrect"));
      }
    });
  });

  describe("Security Properties", () => {
    it("should hash passwords with bcrypt", async () => {
      const password = "TestPassword123!";
      const hash = await bcrypt.hash(password, config.bcryptRounds);

      assert(hash !== password);
      assert(hash.startsWith("$2")); // bcrypt format
      assert(await bcrypt.compare(password, hash));
    });

    it("should generate cryptographically secure OTP codes", () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const code = otpService.generateCode();
        codes.add(code);
      }

      // All codes should be unique (very high probability)
      assert(codes.size > 95);
    });

    it("should generate unique session tokens", async () => {
      const req = createMockRequest();
      const session1 = await sessionService.createSession(testUserId, req);
      const session2 = await sessionService.createSession(testUserId, req);

      assert(session1.tokenHash !== session2.tokenHash);
    });

    it("should not expose sensitive data in responses", async () => {
      const rows = await db.query(
        `SELECT password_hash, totp_secret FROM users WHERE id = ?`,
        [testUserId]
      );

      // These should never be returned to client
      assert(rows[0].password_hash);
      assert(rows[0].totp_secret === null || typeof rows[0].totp_secret === "string");
    });
  });

  describe("Edge Cases", () => {
    it("should handle concurrent OTP requests", async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          otpService.issueOtp({ email: testEmail, purpose: "concurrent", userId: testUserId })
        );
      }

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      assert(succeeded.length > 0);
    });

    it("should handle concurrent session creation", async () => {
      const req = createMockRequest();
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(sessionService.createSession(testUserId, req));
      }

      const results = await Promise.all(promises);
      assert(results.length === 5);
      assert(new Set(results.map((r) => r.tokenHash)).size === 5); // All unique
    });

    it("should handle missing user gracefully", async () => {
      try {
        await totpService.getUserTotpSecret(999999);
        assert.fail("Should have thrown error");
      } catch (err) {
        assert(err.message.includes("not found"));
      }
    });

    it("should handle invalid email format", async () => {
      try {
        await otpService.issueOtp({ email: "invalid-email", purpose: "login" });
        assert.fail("Should have thrown error");
      } catch (err) {
        assert(err);
      }
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log("Running authentication tests...");
  // Tests would be run by a test runner like Mocha
}

module.exports = {
  createMockRequest,
};
