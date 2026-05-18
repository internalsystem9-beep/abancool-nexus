const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const config = require("./config");
const db = require("./config/db");
const routes = require("./routes");
const { errorHandler, notFound } = require("./middleware/error");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.env === "production" ? "combined" : "dev"));

app.use(
  "/api",
  rateLimit({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.max, standardHeaders: true })
);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await db.ping();
    console.log(`[db] connected to ${config.db.host}/${config.db.database}`);
  } catch (err) {
    console.error("[db] connection failed", err.message);
  }
  app.listen(config.port, () => {
    console.log(`[abancool-api] listening on :${config.port} (${config.env})`);
  });
}

start();

module.exports = app;
