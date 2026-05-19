const express = require('express');
const router = express.Router();
const whmController = require('../controllers/whm.controller');
const { validateRequest } = require('../middleware/validation');
const { requireAuth, requireRole } = require('../middleware/auth');
const whmValidator = require('../validators/whm.validator');

// Apply authentication middleware
router.use(requireAuth);
router.use(requireRole(['admin', 'super_admin']));

// ===== ACCOUNTS ROUTES =====

router.post('/accounts/create', validateRequest(whmValidator.createAccountSchema), whmController.createAccount);

router.post('/accounts/:username/suspend', validateRequest(whmValidator.suspendAccountSchema), whmController.suspendAccount);

router.post('/accounts/:username/unsuspend', whmController.unsuspendAccount);

router.post('/accounts/:username/terminate', validateRequest(whmValidator.terminateAccountSchema), whmController.terminateAccount);

router.get('/accounts', whmController.listAccounts);

router.get('/accounts/:username', whmController.getAccount);

router.post('/accounts/:username/password', validateRequest(whmValidator.changePasswordSchema), whmController.changePassword);

router.post('/accounts/:username/upgrade', validateRequest(whmValidator.upgradeAccountSchema), whmController.upgradeAccount);

// ===== PACKAGES ROUTES =====

router.get('/packages', whmController.listPackages);

router.post('/packages', validateRequest(whmValidator.createPackageSchema), whmController.createPackage);

router.put('/packages/:name', validateRequest(whmValidator.editPackageSchema), whmController.editPackage);

// ===== BANDWIDTH ROUTES =====

router.get('/bandwidth', whmController.getBandwidth);

router.get('/bandwidth/:username/history', whmController.getBandwidthHistory);

// ===== SSL ROUTES =====

router.get('/ssl', whmController.listSSLCertificates);

router.post('/ssl/csr', validateRequest(whmValidator.generateCSRSchema), whmController.generateCSR);

router.get('/ssl/:username/status', whmController.getSSLStatus);

// ===== SESSIONS ROUTES =====

router.post('/sessions/login', validateRequest(whmValidator.createLoginSessionSchema), whmController.createLoginSession);

router.post('/sso-link', validateRequest(whmValidator.generateSSOLinkSchema), whmController.generateSSOLink);

// ===== DNS ROUTES =====

router.get('/dns', whmController.listDNSZones);

router.post('/dns/zones', validateRequest(whmValidator.createDNSZoneSchema), whmController.createDNSZone);

router.post('/dns/mx', validateRequest(whmValidator.createMXRecordSchema), whmController.createMXRecord);

module.exports = router;
