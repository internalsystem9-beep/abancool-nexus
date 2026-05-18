const router = require("express").Router();
const auth = require("./controllers/auth.controller");
const otp = require("./controllers/otp.controller");
const analytics = require("./controllers/analytics.controller");
const clients = require("./controllers/clients.controller");
const { authRequired } = require("./middleware/auth");
const rateLimit = require("express-rate-limit");

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true });

// Health
router.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth (password)
router.post("/auth/signup", auth.signup);
router.post("/auth/login", auth.login);
router.get("/auth/me", authRequired, auth.me);

// Auth (OTP / 2FA flow)
router.post("/auth/login-init", otpLimiter, otp.loginInit);     // step 1: email+password → issue OTP
router.post("/auth/verify-otp", otpLimiter, otp.verifyLoginOtp); // step 2: email+code → JWT
router.post("/auth/resend-otp", otpLimiter, otp.resendOtp);

// Analytics
router.get("/analytics/summary", authRequired, analytics.summary);

// Clients
router.get("/clients", authRequired, clients.list);
router.get("/clients/:id", authRequired, clients.get);
router.post("/clients", authRequired, clients.create);
router.put("/clients/:id", authRequired, clients.update);
router.delete("/clients/:id", authRequired, clients.remove);

module.exports = router;
