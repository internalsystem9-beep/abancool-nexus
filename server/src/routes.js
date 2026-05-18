const router = require("express").Router();
const auth = require("./controllers/auth.controller");
const analytics = require("./controllers/analytics.controller");
const clients = require("./controllers/clients.controller");
const { authRequired } = require("./middleware/auth");

// Health
router.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth
router.post("/auth/signup", auth.signup);
router.post("/auth/login", auth.login);
router.get("/auth/me", authRequired, auth.me);

// Analytics
router.get("/analytics/summary", authRequired, analytics.summary);

// Clients
router.get("/clients", authRequired, clients.list);
router.get("/clients/:id", authRequired, clients.get);
router.post("/clients", authRequired, clients.create);
router.put("/clients/:id", authRequired, clients.update);
router.delete("/clients/:id", authRequired, clients.remove);

module.exports = router;
