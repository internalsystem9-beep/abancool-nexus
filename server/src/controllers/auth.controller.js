const bcrypt = require("bcryptjs");
const { z } = require("zod");
const crypto = require("crypto");
const db = require("../config/db");
const config = require("../config");
const { signToken } = require("../middleware/auth");
const totpService = require("../services/totp.service");
const sessionService = require("../services/session.service");
const passwordResetService = require("../services/password-reset.service");

const signupSchema = z.object({
  first_name: z.string().min(2).max(100),
  last_name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetSchema = z.object({
  userId: z.number().int().positive(),
  resetToken: z.string().min(32),
  newPassword: z.string().min(8).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const totpVerifySchema = z.object({
  token: z.string().regex(/^\d{6}$/),
});

async function signup(req, res, next) {
  try {
    const { first_name, last_name, email, password } = signupSchema.parse(req.body);

    const existing = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const result = await db.query(
      "INSERT INTO users (first_name, last_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)",
      [first_name, last_name, email, passwordHash, "active"]
    );

    const user = { id: result.insertId, first_name, last_name, email };
    const token = signToken({ id: user.id, email: user.email });
    
    // Create initial session
    const session = await sessionService.createSession(user.id, req);

    res.status(201).json({ 
      success: true,
      user, 
      token,
      sessionId: session.sessionId,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const rows = await db.query(
      "SELECT id, first_name, last_name, email, password_hash, totp_enabled FROM users WHERE email = ? AND deleted_at IS NULL",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ success: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });

    // Update last login
    const ipAddress = sessionService.getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";
    await db.query(
      `UPDATE users SET last_login_at = NOW(), last_login_ip = ?, last_login_user_agent = ? WHERE id = ?`,
      [ipAddress, userAgent, user.id]
    );

    // If 2FA is enabled, require TOTP verification
    if (user.totp_enabled) {
      return res.json({
        success: true,
        requiresTwoFactor: true,
        userId: user.id,
        email: user.email,
      });
    }

    // Create session and token
    const session = await sessionService.createSession(user.id, req);
    const token = signToken({ id: user.id, email: user.email, sessionId: session.sessionId });

    res.json({
      success: true,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email },
      token,
      sessionId: session.sessionId,
    });
  } catch (err) {
    next(err);
  }
}

async function setupTwoFactor(req, res, next) {
  try {
    const userId = req.user.id;

    // Generate TOTP secret
    const { secret, qrCode, backupCodes } = await totpService.generateTotpSecret(
      req.user.email
    );

    res.json({
      success: true,
      secret,
      qrCode,
      backupCodes,
      message: "Scan the QR code with your authenticator app and verify with a code",
    });
  } catch (err) {
    next(err);
  }
}

async function verifyTwoFactorSetup(req, res, next) {
  try {
    const userId = req.user.id;
    const { token, secret, backupCodes } = z.object({
      token: z.string().regex(/^\d{6}$/),
      secret: z.string().min(32),
      backupCodes: z.array(z.string()),
    }).parse(req.body);

    // Verify the token with the provided secret
    const isValid = totpService.verifyTotpToken(secret, token);
    if (!isValid) {
      return res.status(400).json({ success: false, error: "Invalid verification code" });
    }

    // Enable 2FA
    await totpService.enableTwoFactor(userId, secret, backupCodes);

    res.json({
      success: true,
      message: "Two-factor authentication enabled successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function verifyTwoFactor(req, res, next) {
  try {
    const { userId, token } = z.object({
      userId: z.number().int().positive(),
      token: z.string().regex(/^\d{6}$/),
    }).parse(req.body);

    // Verify TOTP token
    await totpService.verifyUserTotpToken(userId, token);

    // Get user info
    const rows = await db.query(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [userId]
    );
    const user = rows[0];

    // Create session and token
    const session = await sessionService.createSession(userId, req);
    const jwtToken = signToken({ id: userId, email: user.email, sessionId: session.sessionId });

    res.json({
      success: true,
      user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email },
      token: jwtToken,
      sessionId: session.sessionId,
    });
  } catch (err) {
    next(err);
  }
}

async function disableTwoFactor(req, res, next) {
  try {
    const userId = req.user.id;
    const { password } = z.object({
      password: z.string().min(1),
    }).parse(req.body);

    // Verify password
    const rows = await db.query("SELECT password_hash FROM users WHERE id = ?", [userId]);
    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ success: false, error: "Invalid password" });
    }

    // Disable 2FA
    await totpService.disableTwoFactor(userId);

    res.json({
      success: true,
      message: "Two-factor authentication disabled",
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const userId = req.user.id;

    // Validate current session
    const rows = await db.query(
      "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, error: "User not found" });
    }

    // Create new session
    const session = await sessionService.createSession(userId, req);
    const token = signToken({ id: userId, email: req.user.email, sessionId: session.sessionId });

    res.json({
      success: true,
      token,
      sessionId: session.sessionId,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const userId = req.user.id;
    const sessionId = req.user.sessionId;

    if (sessionId) {
      await sessionService.invalidateSession(sessionId);
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = passwordResetRequestSchema.parse(req.body);
    await passwordResetService.requestPasswordReset(email);

    res.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent",
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { userId, resetToken, newPassword } = passwordResetSchema.parse(req.body);
    await passwordResetService.resetPassword(userId, resetToken, newPassword);

    res.json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    await passwordResetService.changePassword(userId, currentPassword, newPassword);

    // Invalidate all sessions
    await sessionService.invalidateAllUserSessions(userId);

    res.json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, first_name, last_name, email, status, totp_enabled, last_login_at, created_at FROM users WHERE id = ? AND deleted_at IS NULL",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const sessions = await sessionService.getUserSessions(userId);

    res.json({
      success: true,
      sessions,
    });
  } catch (err) {
    next(err);
  }
}

async function logoutAllDevices(req, res, next) {
  try {
    const userId = req.user.id;
    await sessionService.invalidateAllUserSessions(userId);

    res.json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  login,
  setupTwoFactor,
  verifyTwoFactorSetup,
  verifyTwoFactor,
  disableTwoFactor,
  refreshToken,
  logout,
  requestPasswordReset,
  resetPassword,
  changePassword,
  me,
  getSessions,
  logoutAllDevices,
};
