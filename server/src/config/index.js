require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  env: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
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
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "300", 10),
  },
};

module.exports = config;
