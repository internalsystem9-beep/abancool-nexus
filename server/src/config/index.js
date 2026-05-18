require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "4000", 10),
  env: process.env.NODE_ENV || "development",
  appName: process.env.APP_NAME || "ABANCOOL Command Center",
  corsOrigins: (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-only-do-not-use-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  otp: {
    length: parseInt(process.env.OTP_LENGTH || "6", 10),
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES || "10", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10),
    devReturn: process.env.OTP_DEV_RETURN === "true",
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: process.env.SMTP_SECURE !== "false",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || "no-reply@example.com",
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "300", 10),
  },
};
