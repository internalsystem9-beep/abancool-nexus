const router = require("express").Router();
const auth = require("./controllers/auth.controller");
const otp = require("./controllers/otp.controller");
const analytics = require("./controllers/analytics.controller");
const clients = require("./controllers/clients.controller");
const users = require("./controllers/users.controller");
const projects = require("./controllers/projects.controller");
const hosting = require("./controllers/hosting.controller");
const domains = require("./controllers/domains.controller");
const vps = require("./controllers/vps.controller");
const passwordVault = require("./controllers/password_vault.controller");
const fileManagement = require("./controllers/file_management.controller");
const billing = require("./controllers/billing.controller");
const payment = require("./controllers/payment.controller");
const sms = require("./controllers/sms.controller");
const whatsapp = require("./controllers/whatsapp.controller");
const supportTickets = require("./controllers/support_tickets.controller");
const automation = require("./controllers/automation.controller");
const realtime = require("./controllers/realtime.controller");
const email = require("./controllers/email.controller");
const audit = require("./controllers/audit.controller");
const devops = require("./controllers/devops.controller");
const backup = require("./controllers/backup.controller");
const { authRequired } = require("./middleware/auth");
const { requireRole, requirePermission } = require("./middleware/rbac");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  standardHeaders: true,
  message: "Too many authentication attempts, please try again later"
});

const otpLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  standardHeaders: true,
  message: "Too many OTP attempts, please try again later"
});

// Health
router.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Auth - Registration & Login
router.post("/auth/signup", authLimiter, auth.signup);
router.post("/auth/login", authLimiter, auth.login);

// Auth - OTP / 2FA flow
router.post("/auth/login-init", otpLimiter, otp.loginInit);
router.post("/auth/verify-otp", otpLimiter, otp.verifyLoginOtp);
router.post("/auth/resend-otp", otpLimiter, otp.resendOtp);

// Auth - 2FA (TOTP)
router.post("/auth/2fa/setup", authRequired, auth.setupTwoFactor);
router.post("/auth/2fa/verify-setup", authRequired, auth.verifyTwoFactorSetup);
router.post("/auth/2fa/verify", auth.verifyTwoFactor);
router.post("/auth/2fa/disable", authRequired, auth.disableTwoFactor);

// Auth - Token & Session Management
router.post("/auth/refresh", authRequired, auth.refreshToken);
router.post("/auth/logout", authRequired, auth.logout);
router.get("/auth/sessions", authRequired, auth.getSessions);
router.post("/auth/logout-all", authRequired, auth.logoutAllDevices);

// Auth - Password Management
router.post("/auth/password/reset-request", authLimiter, auth.requestPasswordReset);
router.post("/auth/password/reset", authLimiter, auth.resetPassword);
router.post("/auth/password/change", authRequired, auth.changePassword);

// Auth - User Profile
router.get("/auth/me", authRequired, auth.me);

// Analytics
router.get("/analytics/summary", authRequired, analytics.summary);

// Clients - Main CRUD operations
router.get("/clients", authRequired, clients.list);
router.get("/clients/:id", authRequired, clients.get);
router.post("/clients", authRequired, requirePermission("manage_clients"), clients.create);
router.put("/clients/:id", authRequired, requirePermission("manage_clients"), clients.update);
router.delete("/clients/:id", authRequired, requirePermission("manage_clients"), clients.remove);

// Clients - Contact management
router.post("/clients/:id/contacts", authRequired, requirePermission("manage_clients"), clients.addContact);
router.get("/clients/:id/contacts", authRequired, clients.getContacts);
router.put("/clients/:id/contacts/:contactId", authRequired, requirePermission("manage_clients"), clients.updateContact);
router.delete("/clients/:id/contacts/:contactId", authRequired, requirePermission("manage_clients"), clients.deleteContact);

// Clients - Related data
router.get("/clients/:id/projects", authRequired, clients.getProjects);
router.get("/clients/:id/billing", authRequired, requirePermission("manage_billing"), clients.getBilling);

// Users - User Management with RBAC
router.post("/users", authRequired, requireRole("super_admin"), users.create);
router.get("/users", authRequired, users.list);
router.get("/users/search", authRequired, users.search);
router.get("/users/:id", authRequired, users.get);
router.put("/users/:id", authRequired, users.update);
router.put("/users/:id/roles", authRequired, requireRole("super_admin"), users.updateRoles);
router.put("/users/:id/status", authRequired, requireRole("super_admin"), users.updateStatus);
router.delete("/users/:id", authRequired, requireRole("super_admin"), users.remove);
router.get("/users/:id/audit", authRequired, users.getAuditLog);
router.post("/users/:id/clients/:clientId", authRequired, requireRole("super_admin", "admin"), users.assignToClient);
router.delete("/users/:id/clients/:clientId", authRequired, requireRole("super_admin", "admin"), users.removeFromClient);

// Projects - Project Management with Team Assignments
router.get("/projects", authRequired, requirePermission("read_projects", "manage_projects"), projects.list);
router.get("/projects/:id", authRequired, requirePermission("read_projects", "manage_projects"), projects.get);
router.post("/projects", authRequired, requirePermission("manage_projects"), projects.create);
router.put("/projects/:id", authRequired, requirePermission("manage_projects", "update_projects"), projects.update);
router.put("/projects/:id/status", authRequired, requirePermission("manage_projects", "update_projects"), projects.updateStatus);
router.put("/projects/:id/deployment", authRequired, requirePermission("manage_projects", "update_projects"), projects.addDeployment);
router.delete("/projects/:id", authRequired, requirePermission("manage_projects"), projects.remove);

// Projects - Team Management
router.post("/projects/:id/team", authRequired, requirePermission("manage_projects"), projects.assignTeamMember);
router.delete("/projects/:id/team/:userId", authRequired, requirePermission("manage_projects"), projects.removeTeamMember);
router.get("/projects/:id/team", authRequired, requirePermission("read_projects", "manage_projects"), projects.getTeam);

// Projects - Audit Log
router.get("/projects/:id/audit", authRequired, projects.getAuditLog);

// Hosting - Hosting Accounts Management
router.get("/hosting", authRequired, requirePermission("manage_hosting", "read_hosting"), hosting.list);
router.get("/hosting/:id", authRequired, requirePermission("manage_hosting", "read_hosting"), hosting.get);
router.post("/hosting", authRequired, requirePermission("manage_hosting"), hosting.create);
router.put("/hosting/:id", authRequired, requirePermission("manage_hosting"), hosting.update);
router.delete("/hosting/:id", authRequired, requirePermission("manage_hosting"), hosting.remove);
router.get("/hosting/:id/usage", authRequired, requirePermission("read_hosting", "manage_hosting"), hosting.getUsage);

// Hosting - Packages Management
router.get("/hosting/packages", authRequired, hosting.listPackages);
router.post("/hosting/packages", authRequired, requirePermission("manage_hosting"), hosting.createPackage);

// Domains - Domain Registration and SSL Management
router.get("/domains", authRequired, requirePermission("manage_domains", "read_domains"), domains.list);
router.get("/domains/:id", authRequired, requirePermission("manage_domains", "read_domains"), domains.get);
router.post("/domains", authRequired, requirePermission("manage_domains"), domains.create);
router.put("/domains/:id", authRequired, requirePermission("manage_domains"), domains.update);
router.put("/domains/:id/ssl", authRequired, requirePermission("manage_domains"), domains.updateSSL);
router.put("/domains/:id/renewal", authRequired, requirePermission("manage_domains"), domains.updateRenewal);
router.delete("/domains/:id", authRequired, requirePermission("manage_domains"), domains.remove);

// VPS - Server Management and Monitoring
router.get("/vps", authRequired, requirePermission("manage_vps", "read_vps"), vps.list);
router.get("/vps/:id", authRequired, requirePermission("manage_vps", "read_vps"), vps.get);
router.post("/vps", authRequired, requirePermission("manage_vps"), vps.create);
router.put("/vps/:id", authRequired, requirePermission("manage_vps"), vps.update);
router.delete("/vps/:id", authRequired, requirePermission("manage_vps"), vps.remove);
router.post("/vps/:id/metrics", authRequired, requirePermission("manage_vps"), vps.recordMetrics);
router.get("/vps/:id/metrics", authRequired, requirePermission("read_vps", "manage_vps"), vps.getMetrics);

// Password Vault - Encrypted Credential Storage
router.get("/vault", authRequired, passwordVault.list);
router.get("/vault/:id", authRequired, passwordVault.get);
router.post("/vault", authRequired, passwordVault.create);
router.put("/vault/:id", authRequired, passwordVault.update);
router.delete("/vault/:id", authRequired, passwordVault.remove);
router.patch("/vault/:id/archive", authRequired, passwordVault.archive);
router.patch("/vault/:id/restore", authRequired, passwordVault.restore);
router.get("/vault/stats", authRequired, passwordVault.getStats);

// File Management - Upload, Download, and Storage
router.get("/files", authRequired, fileManagement.list);
router.get("/files/:id", authRequired, fileManagement.get);
router.post("/files/upload", authRequired, fileManagement.upload);
router.get("/files/:id/download", authRequired, fileManagement.download);
router.post("/files/:id/token", authRequired, fileManagement.generateToken);
router.delete("/files/:id", authRequired, fileManagement.remove);
router.get("/files/stats", authRequired, fileManagement.getStats);
router.get("/files/analysis", authRequired, fileManagement.getAnalysis);

// Billing - Invoice Management
router.get("/invoices", authRequired, requirePermission("read_invoices", "manage_invoices"), billing.listInvoices);
router.post("/invoices", authRequired, requirePermission("manage_invoices"), billing.createInvoice);
router.get("/invoices/:id", authRequired, requirePermission("read_invoices", "manage_invoices"), billing.getInvoice);
router.put("/invoices/:id", authRequired, requirePermission("manage_invoices"), billing.updateInvoice);
router.patch("/invoices/:id/status", authRequired, requirePermission("manage_invoices"), billing.updateInvoiceStatus);
router.delete("/invoices/:id", authRequired, requirePermission("manage_invoices"), billing.deleteInvoice);

// Billing - Quote Management
router.get("/quotes", authRequired, requirePermission("read_quotes", "manage_quotes"), billing.listQuotes);
router.post("/quotes", authRequired, requirePermission("manage_quotes"), billing.createQuote);
router.get("/quotes/:id", authRequired, requirePermission("read_quotes", "manage_quotes"), billing.getQuote);
router.put("/quotes/:id", authRequired, requirePermission("manage_quotes"), billing.updateQuote);
router.patch("/quotes/:id/status", authRequired, requirePermission("manage_quotes"), billing.updateQuoteStatus);
router.post("/quotes/:id/convert", authRequired, requirePermission("manage_quotes"), billing.convertQuoteToInvoice);
router.delete("/quotes/:id", authRequired, requirePermission("manage_quotes"), billing.deleteQuote);

// Billing - Analytics
router.get("/billing/stats", authRequired, requirePermission("read_invoices", "read_quotes", "manage_invoices", "manage_quotes"), billing.getBillingStats);

// Payment Gateway - M-Pesa
router.post("/payments/mpesa/initiate", authRequired, requirePermission("manage_payments"), payment.initiateMpesaPayment);
router.post("/payments/mpesa/webhook", payment.handleMpesaWebhook);

// Payment Gateway - Paystack
router.post("/payments/paystack/initiate", authRequired, requirePermission("manage_payments"), payment.initiatePaystackPayment);
router.post("/payments/paystack/webhook", payment.handlePaystackWebhook);
router.get("/payments/paystack/verify", authRequired, payment.verifyPaystackPayment);

// Payment Gateway - IntaSend
router.post("/payments/intasend/initiate", authRequired, requirePermission("manage_payments"), payment.initiateIntaSendPayment);
router.post("/payments/intasend/webhook", payment.handleIntaSendWebhook);

// Payment Management
router.get("/payments/:id", authRequired, requirePermission("read_payments", "manage_payments"), payment.getTransaction);
router.get("/payments", authRequired, requirePermission("read_payments", "manage_payments"), payment.listTransactions);
router.post("/payments/:transaction_id/refund", authRequired, requirePermission("manage_payments"), payment.refundPayment);
router.get("/payments/reports/reconciliation", authRequired, requirePermission("read_payments", "manage_payments"), payment.getReconciliationReport);

// SMS Engine - Send and Manage SMS
router.post("/sms/send", authRequired, requirePermission("send_sms"), sms.sendSms);
router.post("/sms/bulk", authRequired, requirePermission("send_sms"), sms.sendBulkSms);
router.get("/sms/:id/status", authRequired, sms.getSmsStatus);

// SMS - OTP Management
router.post("/sms/otp/send", authRequired, sms.sendOtp);
router.post("/sms/otp/verify", authRequired, sms.verifyOtp);

// SMS - Templates
router.get("/sms/templates", authRequired, sms.getSmsTemplates);
router.post("/sms/templates", authRequired, requirePermission("manage_templates"), sms.createSmsTemplate);

// SMS - Statistics
router.get("/sms/stats", authRequired, requirePermission("read_sms"), sms.getSmsStats);

// SMS - Webhooks (no auth required)
router.post("/webhooks/africastalking", sms.handleAfricasTalkingWebhook);
router.post("/webhooks/twilio", sms.handleTwilioWebhook);

// WhatsApp Engine - Send and Manage WhatsApp Messages
router.post("/whatsapp/send", authRequired, requirePermission("send_whatsapp"), whatsapp.sendWhatsAppMessage);
router.post("/whatsapp/bulk", authRequired, requirePermission("send_whatsapp"), whatsapp.sendBulkWhatsApp);
router.get("/whatsapp/:id/status", authRequired, whatsapp.getWhatsAppStatus);

// WhatsApp - OTP Management
router.post("/whatsapp/otp/send", authRequired, whatsapp.sendWhatsAppOTP);
router.post("/whatsapp/otp/verify", authRequired, whatsapp.verifyWhatsAppOTP);

// WhatsApp - Templates
router.get("/whatsapp/templates", authRequired, whatsapp.getWhatsAppTemplates);
router.post("/whatsapp/templates", authRequired, requirePermission("manage_whatsapp_templates"), whatsapp.createWhatsAppTemplate);

// WhatsApp - Statistics
router.get("/whatsapp/stats", authRequired, requirePermission("read_whatsapp"), whatsapp.getWhatsAppStats);

// WhatsApp - Webhook (no auth required)
router.post("/webhooks/whatsapp", whatsapp.handleWhatsAppWebhook);

// Support Ticket System - Create and List Tickets
router.post("/tickets", authRequired, supportTickets.createTicket);
router.get("/tickets", authRequired, supportTickets.listTickets);
router.get("/tickets/search", authRequired, supportTickets.searchTickets);
router.get("/tickets/:id", authRequired, supportTickets.getTicketDetails);

// Support Tickets - Status and Assignment
router.patch("/tickets/:id/status", authRequired, requirePermission("manage_tickets"), supportTickets.updateTicketStatus);
router.patch("/tickets/:id/priority", authRequired, requirePermission("manage_tickets"), supportTickets.updateTicketPriority);
router.patch("/tickets/:id/assign", authRequired, requirePermission("manage_tickets"), supportTickets.assignTicket);
router.post("/tickets/:id/close", authRequired, supportTickets.closeTicket);

// Support Tickets - Comments and History
router.post("/tickets/:id/comments", authRequired, supportTickets.addTicketComment);
router.get("/tickets/:id/comments", authRequired, supportTickets.getTicketComments);
router.get("/tickets/:id/history", authRequired, supportTickets.getTicketHistory);

// Support Tickets - Statistics
router.get("/tickets/stats/overview", authRequired, requirePermission("read_tickets"), supportTickets.getTicketStats);

// Automation Engine - Job Management
router.post("/automation/jobs", authRequired, requirePermission("manage_automation"), automation.createJob);
router.get("/automation/jobs", authRequired, requirePermission("read_automation"), automation.listJobs);
router.get("/automation/jobs/:id", authRequired, requirePermission("read_automation"), automation.getJobDetails);
router.patch("/automation/jobs/:id", authRequired, requirePermission("manage_automation"), automation.updateJob);
router.delete("/automation/jobs/:id", authRequired, requirePermission("manage_automation"), automation.deleteJob);
router.patch("/automation/jobs/:id/toggle", authRequired, requirePermission("manage_automation"), automation.toggleJob);

// Automation Engine - Job Execution
router.post("/automation/jobs/:id/execute", authRequired, requirePermission("manage_automation"), automation.executeJob);
router.get("/automation/jobs/:id/history", authRequired, requirePermission("read_automation"), automation.getJobHistory);
router.get("/automation/jobs/:id/logs", authRequired, requirePermission("read_automation"), automation.getJobLogs);

// Automation Engine - Statistics
router.get("/automation/stats", authRequired, requirePermission("read_automation"), automation.getAutomationStats);

// Real-time Features - Notifications
router.post("/realtime/notifications", authRequired, requirePermission("send_notifications"), (req, res) => {
  const io = req.app.get("io");
  realtime.sendNotification(req, res, io);
});
router.get("/realtime/notifications", authRequired, realtime.getNotifications);
router.patch("/realtime/notifications/:notification_id/read", authRequired, (req, res) => {
  const io = req.app.get("io");
  realtime.markNotificationRead(req, res, io);
});

// Real-time Features - Chat Messaging
router.post("/realtime/messages", authRequired, (req, res) => {
  const io = req.app.get("io");
  realtime.sendChatMessage(req, res, io);
});
router.get("/realtime/messages/history", authRequired, realtime.getChatHistory);
router.patch("/realtime/messages/:message_id/read", authRequired, (req, res) => {
  const io = req.app.get("io");
  realtime.markChatMessageRead(req, res, io);
});

// Real-time Features - Presence
router.get("/realtime/users/online", authRequired, realtime.getOnlineUsers);
router.get("/realtime/users/:user_id/online", authRequired, realtime.checkUserOnline);

// Real-time Features - Rooms
router.get("/realtime/rooms/:room_id/members", authRequired, realtime.getRoomMembers);
router.post("/realtime/rooms/broadcast", authRequired, (req, res) => {
  const io = req.app.get("io");
  realtime.broadcastToRoom(req, res, io);
});

// Real-time Features - Activity Feed
router.post("/realtime/activities", authRequired, (req, res) => {
  const io = req.app.get("io");
  realtime.logActivity(req, res, io);
});
router.get("/realtime/activities", authRequired, realtime.getActivityFeed);

// Real-time Features - Alerts
router.post("/realtime/alerts", authRequired, requirePermission("send_alerts"), (req, res) => {
  const io = req.app.get("io");
  realtime.sendAlert(req, res, io);
});

// Real-time Features - Statistics
router.get("/realtime/stats", authRequired, realtime.getConnectionStats);

// Email System - Sending
router.post("/email/send", authRequired, requirePermission("send_email"), email.sendEmail);
router.post("/email/send-bulk", authRequired, requirePermission("send_email"), email.sendBulkEmail);
router.post("/email/resend/:email_log_id", authRequired, requirePermission("send_email"), email.resendEmail);

// Email System - Templates
router.post("/email/templates", authRequired, requirePermission("manage_email"), email.createEmailTemplate);
router.get("/email/templates", authRequired, requirePermission("read_email"), email.getEmailTemplates);
router.get("/email/templates/:id", authRequired, requirePermission("read_email"), email.getEmailTemplate);
router.patch("/email/templates/:id", authRequired, requirePermission("manage_email"), email.updateEmailTemplate);
router.delete("/email/templates/:id", authRequired, requirePermission("manage_email"), email.deleteEmailTemplate);

// Email System - History & Details
router.get("/email/history", authRequired, requirePermission("read_email"), email.getEmailHistory);
router.get("/email/history/:id", authRequired, requirePermission("read_email"), email.getEmailDetails);

// Email System - Verification
router.post("/email/verify", authRequired, email.verifyEmail);

// Email System - Statistics
router.get("/email/stats", authRequired, requirePermission("read_email"), email.getEmailStats);

// Audit and Activity Logging - Audit Logs
router.get("/audit/logs", authRequired, requirePermission("read_audit"), audit.getAuditLogs);
router.get("/audit/logs/:id", authRequired, requirePermission("read_audit"), audit.getAuditLogDetails);
router.post("/audit/logs/search", authRequired, requirePermission("read_audit"), audit.searchAuditLogs);
router.get("/audit/stats", authRequired, requirePermission("read_audit"), audit.getAuditStats);

// Audit and Activity Logging - Activity Logs
router.get("/audit/activities", authRequired, requirePermission("read_audit"), audit.getActivityLogs);
router.get("/audit/activities/stats", authRequired, requirePermission("read_audit"), audit.getActivityStats);

// Audit and Activity Logging - User Activity
router.get("/audit/users/:user_id/timeline", authRequired, requirePermission("read_audit"), audit.getUserActivityTimeline);
router.get("/audit/users/:user_id/trail", authRequired, requirePermission("read_audit"), audit.getUserAuditTrail);
router.get("/audit/users/:user_id/summary", authRequired, requirePermission("read_audit"), audit.getUserActivitySummary);

// Audit and Activity Logging - Sensitive Data Access
router.get("/audit/sensitive-access", authRequired, requirePermission("read_audit"), audit.getSensitiveDataAccessLogs);

// Audit and Activity Logging - Cleanup & Maintenance
router.post("/audit/cleanup/audit-logs", authRequired, requirePermission("manage_audit"), audit.cleanupOldAuditLogs);
router.post("/audit/cleanup/activity-logs", authRequired, requirePermission("manage_audit"), audit.cleanupOldActivityLogs);

// Audit and Activity Logging - Export
router.get("/audit/export/audit-logs", authRequired, requirePermission("read_audit"), audit.exportAuditLogs);
router.get("/audit/export/activity-logs", authRequired, requirePermission("read_audit"), audit.exportActivityLogs);

// Audit and Activity Logging - Compliance
router.get("/audit/compliance-report", authRequired, requirePermission("read_audit"), audit.getComplianceReport);

// DevOps Module - Server Metrics
router.get("/devops/metrics", authRequired, requirePermission("read_devops"), devops.getServerMetrics);
router.get("/devops/cpu", authRequired, requirePermission("read_devops"), devops.getCPUUsage);
router.get("/devops/memory", authRequired, requirePermission("read_devops"), devops.getMemoryUsage);
router.get("/devops/uptime", authRequired, requirePermission("read_devops"), devops.getServerUptime);

// DevOps Module - Health Checks
router.get("/devops/health", authRequired, requirePermission("read_devops"), devops.getHealthCheck);
router.post("/devops/health/record", authRequired, requirePermission("manage_devops"), devops.recordHealthCheck);
router.get("/devops/health/history", authRequired, requirePermission("read_devops"), devops.getHealthCheckHistory);

// DevOps Module - Process & Services
router.get("/devops/processes", authRequired, requirePermission("read_devops"), devops.getProcessStatus);

// DevOps Module - Logs & Monitoring
router.get("/devops/logs/summary", authRequired, requirePermission("read_devops"), devops.getLogsSummary);

// DevOps Module - Alert Management
router.post("/devops/alerts", authRequired, requirePermission("manage_devops"), devops.createAlertRule);
router.get("/devops/alerts", authRequired, requirePermission("read_devops"), devops.getAlertRules);
router.patch("/devops/alerts/:id", authRequired, requirePermission("manage_devops"), devops.updateAlertRule);
router.delete("/devops/alerts/:id", authRequired, requirePermission("manage_devops"), devops.deleteAlertRule);

// DevOps Module - Backup & Diagnostics
router.get("/devops/backups/status", authRequired, requirePermission("read_devops"), devops.getBackupStatus);
router.get("/devops/diagnostics", authRequired, requirePermission("read_devops"), devops.getSystemDiagnostics);

// Backup System - Backup Creation & Management
router.post("/backups", authRequired, requirePermission("manage_backups"), backup.createBackup);
router.get("/backups", authRequired, requirePermission("read_backups"), backup.getBackupHistory);
router.get("/backups/:id", authRequired, requirePermission("read_backups"), backup.getBackupDetails);
router.delete("/backups/:id", authRequired, requirePermission("manage_backups"), backup.deleteBackup);

// Backup System - Backup Scheduling
router.post("/backups/schedules", authRequired, requirePermission("manage_backups"), backup.scheduleBackup);
router.get("/backups/schedules", authRequired, requirePermission("read_backups"), backup.getBackupSchedules);
router.patch("/backups/schedules/:id", authRequired, requirePermission("manage_backups"), backup.updateBackupSchedule);
router.delete("/backups/schedules/:id", authRequired, requirePermission("manage_backups"), backup.deleteBackupSchedule);

// Backup System - Restore Operations
router.post("/backups/:id/restore", authRequired, requirePermission("manage_backups"), backup.restoreFromBackup);
router.post("/backups/:id/restore/files", authRequired, requirePermission("manage_backups"), backup.restoreFileBackup);
router.get("/restores/:id/status", authRequired, requirePermission("read_backups"), backup.getRestoreStatus);
router.get("/restores", authRequired, requirePermission("read_backups"), backup.getRestoreHistory);

// Backup System - Verification & Storage
router.post("/backups/:id/verify", authRequired, requirePermission("manage_backups"), backup.verifyBackupIntegrity);
router.get("/backups/:id/verification", authRequired, requirePermission("read_backups"), backup.getBackupVerification);
router.get("/backups/storage/stats", authRequired, requirePermission("read_backups"), backup.getBackupStorage);
router.post("/backups/storage/cleanup", authRequired, requirePermission("manage_backups"), backup.cleanupOldBackups);

module.exports = router;
