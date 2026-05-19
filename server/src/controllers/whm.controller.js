const {
  AccountsService,
  PackagesService,
  BandwidthService,
  SSLService,
  SessionsService,
  DNSService,
} = require('../integrations/whm');
const logger = require('../middleware/logger');
const { successResponse, errorResponse } = require('../lib/response-formatter');

class WHMController {
  // ===== ACCOUNTS =====

  async createAccount(req, res) {
    try {
      const { username, domain, password, contactemail, plan } = req.body;

      const result = await AccountsService.createAccount({
        username,
        domain,
        password,
        contactemail,
        plan,
      });

      return successResponse(res, 'Account created successfully', result, 201);
    } catch (error) {
      logger.error('[Controller] Create account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async suspendAccount(req, res) {
    try {
      const { username } = req.params;
      const { reason } = req.body;

      const result = await AccountsService.suspendAccount(username, reason);

      return successResponse(res, 'Account suspended successfully', result);
    } catch (error) {
      logger.error('[Controller] Suspend account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async unsuspendAccount(req, res) {
    try {
      const { username } = req.params;

      const result = await AccountsService.unsuspendAccount(username);

      return successResponse(res, 'Account unsuspended successfully', result);
    } catch (error) {
      logger.error('[Controller] Unsuspend account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async terminateAccount(req, res) {
    try {
      const { username } = req.params;
      const { keepDns } = req.body;

      const result = await AccountsService.terminateAccount(username, keepDns);

      return successResponse(res, 'Account terminated successfully', result);
    } catch (error) {
      logger.error('[Controller] Terminate account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async listAccounts(req, res) {
    try {
      const { search } = req.query;

      const accounts = await AccountsService.listAccounts(search);

      return successResponse(res, 'Accounts retrieved successfully', accounts);
    } catch (error) {
      logger.error('[Controller] List accounts failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async getAccount(req, res) {
    try {
      const { username } = req.params;

      const summary = await AccountsService.getAccountSummary(username);

      return successResponse(res, 'Account retrieved successfully', summary);
    } catch (error) {
      logger.error('[Controller] Get account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async changePassword(req, res) {
    try {
      const { username } = req.params;
      const { password } = req.body;

      const result = await AccountsService.changePassword(username, password);

      return successResponse(res, 'Password changed successfully', result);
    } catch (error) {
      logger.error('[Controller] Change password failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async upgradeAccount(req, res) {
    try {
      const { username } = req.params;
      const { newPlan } = req.body;

      const result = await AccountsService.upgradeAccount(username, newPlan);

      return successResponse(res, 'Account upgraded successfully', result);
    } catch (error) {
      logger.error('[Controller] Upgrade account failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  // ===== PACKAGES =====

  async listPackages(req, res) {
    try {
      const packages = await PackagesService.listPackages();

      return successResponse(res, 'Packages retrieved successfully', packages);
    } catch (error) {
      logger.error('[Controller] List packages failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async createPackage(req, res) {
    try {
      const packageData = req.body;

      const result = await PackagesService.createPackage(packageData);

      return successResponse(res, 'Package created successfully', result, 201);
    } catch (error) {
      logger.error('[Controller] Create package failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async editPackage(req, res) {
    try {
      const { name } = req.params;
      const updates = req.body;

      const result = await PackagesService.editPackage(name, updates);

      return successResponse(res, 'Package updated successfully', result);
    } catch (error) {
      logger.error('[Controller] Edit package failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  // ===== BANDWIDTH =====

  async getBandwidth(req, res) {
    try {
      const { username } = req.query;

      const bandwidth = await BandwidthService.getBandwidthUsage(username);

      return successResponse(res, 'Bandwidth data retrieved successfully', bandwidth);
    } catch (error) {
      logger.error('[Controller] Get bandwidth failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async getBandwidthHistory(req, res) {
    try {
      const { username } = req.params;
      const { days } = req.query;

      const history = await BandwidthService.getBandwidthHistory(username, parseInt(days) || 30);

      return successResponse(res, 'Bandwidth history retrieved successfully', history);
    } catch (error) {
      logger.error('[Controller] Get bandwidth history failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  // ===== SSL =====

  async listSSLCertificates(req, res) {
    try {
      const { username } = req.query;

      const certs = await SSLService.listSSLCertificates(username);

      return successResponse(res, 'SSL certificates retrieved successfully', certs);
    } catch (error) {
      logger.error('[Controller] List SSL certificates failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async generateCSR(req, res) {
    try {
      const { username, domain, countryCode, state, city, organization } = req.body;

      const csr = await SSLService.generateCSR(username, domain, countryCode, state, city, organization);

      return successResponse(res, 'CSR generated successfully', csr, 201);
    } catch (error) {
      logger.error('[Controller] Generate CSR failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async getSSLStatus(req, res) {
    try {
      const { username } = req.params;

      const status = await SSLService.getSSLStatus(username);

      return successResponse(res, 'SSL status retrieved successfully', status);
    } catch (error) {
      logger.error('[Controller] Get SSL status failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  // ===== SESSIONS =====

  async createLoginSession(req, res) {
    try {
      const { username, redirectUrl } = req.body;

      const session = await SessionsService.createLoginSession(username, redirectUrl);

      return successResponse(res, 'Login session created successfully', session, 201);
    } catch (error) {
      logger.error('[Controller] Create login session failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async generateSSOLink(req, res) {
    try {
      const { username } = req.body;
      const { returnUrl } = req.query;

      const link = await SessionsService.generateSSOLink(username, returnUrl);

      return successResponse(res, 'SSO link generated successfully', { link }, 201);
    } catch (error) {
      logger.error('[Controller] Generate SSO link failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  // ===== DNS =====

  async listDNSZones(req, res) {
    try {
      const { username } = req.query;

      const zones = await DNSService.listDNSZones(username);

      return successResponse(res, 'DNS zones retrieved successfully', zones);
    } catch (error) {
      logger.error('[Controller] List DNS zones failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async createDNSZone(req, res) {
    try {
      const { domain, nameserver1, nameserver2, nameserver3, nameserver4 } = req.body;

      const result = await DNSService.createDNSZone(
        domain,
        nameserver1,
        nameserver2,
        nameserver3,
        nameserver4
      );

      return successResponse(res, 'DNS zone created successfully', result, 201);
    } catch (error) {
      logger.error('[Controller] Create DNS zone failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }

  async createMXRecord(req, res) {
    try {
      const { domain, priority, exchange } = req.body;

      const result = await DNSService.createMXRecord(domain, priority, exchange);

      return successResponse(res, 'MX record created successfully', result, 201);
    } catch (error) {
      logger.error('[Controller] Create MX record failed', { error: error.message });
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new WHMController();
