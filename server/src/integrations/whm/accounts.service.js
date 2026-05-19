const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class AccountsService {
  async createAccount({
    username,
    domain,
    password,
    contactemail,
    plan = 'default',
    language = 'en',
  }) {
    try {
      logger.info(`[WHM] Creating account: ${username} (${domain})`);

      const params = {
        username,
        domain,
        password,
        contactemail,
        plan,
        language,
        forcedns: 1,
        skipip: 0,
        hasshell: 0,
        redirect: '',
        featurelist: 'default',
      };

      const response = await whmClient.post('/json-api/createacct', params);
      const result = await whmClient.parseResponse(response);

      if (result.data?.account_id) {
        await this.syncAccountToDatabase({
          username,
          domain,
          contactemail,
          plan,
          status: 'active',
          account_id: result.data.account_id,
        });

        logger.info(`[WHM] Account created successfully: ${username}`);
        return result.data;
      }

      throw new Error('Account creation returned no account ID');
    } catch (error) {
      logger.error('[WHM] Account creation failed', { username, domain, error: error.message });
      throw error;
    }
  }

  async suspendAccount(username, reason = 'Administrative suspension') {
    try {
      logger.info(`[WHM] Suspending account: ${username}`);

      const response = await whmClient.post('/json-api/suspendacct', {
        user: username,
        reason,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        'UPDATE hosting_accounts SET status = ?, suspended_reason = ?, suspended_at = NOW() WHERE username = ?',
        ['suspended', reason, username]
      );

      logger.info(`[WHM] Account suspended: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Account suspension failed', { username, error: error.message });
      throw error;
    }
  }

  async unsuspendAccount(username) {
    try {
      logger.info(`[WHM] Unsuspending account: ${username}`);

      const response = await whmClient.post('/json-api/unsuspendacct', {
        user: username,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        'UPDATE hosting_accounts SET status = ?, suspended_reason = NULL, suspended_at = NULL WHERE username = ?',
        ['active', username]
      );

      logger.info(`[WHM] Account unsuspended: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Account unsuspension failed', { username, error: error.message });
      throw error;
    }
  }

  async terminateAccount(username, keepDns = false) {
    try {
      logger.info(`[WHM] Terminating account: ${username}`);

      const response = await whmClient.post('/json-api/removeacct', {
        user: username,
        keepdns: keepDns ? 1 : 0,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        'UPDATE hosting_accounts SET status = ?, terminated_at = NOW() WHERE username = ?',
        ['terminated', username]
      );

      logger.info(`[WHM] Account terminated: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Account termination failed', { username, error: error.message });
      throw error;
    }
  }

  async listAccounts(searchTerm = '') {
    try {
      logger.info('[WHM] Listing accounts');

      const response = await whmClient.get('/json-api/listaccts');
      const result = await whmClient.parseResponse(response);

      let accounts = result.data?.acct || [];

      if (searchTerm) {
        accounts = accounts.filter(
          (acc) =>
            acc.user.includes(searchTerm) ||
            acc.domain.includes(searchTerm) ||
            acc.email.includes(searchTerm)
        );
      }

      await this.syncAccountsToDatabase(accounts);

      logger.info(`[WHM] Retrieved ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      logger.error('[WHM] List accounts failed', { error: error.message });
      throw error;
    }
  }

  async getAccountSummary(username) {
    try {
      logger.info(`[WHM] Getting account summary: ${username}`);

      const response = await whmClient.get('/json-api/accountsummary', {
        user: username,
      });

      const result = await whmClient.parseResponse(response);
      return result.data;
    } catch (error) {
      logger.error('[WHM] Get account summary failed', { username, error: error.message });
      throw error;
    }
  }

  async changePassword(username, password) {
    try {
      logger.info(`[WHM] Changing password for: ${username}`);

      const response = await whmClient.post('/json-api/passwd', {
        user: username,
        password,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        'UPDATE hosting_accounts SET password_changed_at = NOW() WHERE username = ?',
        [username]
      );

      logger.info(`[WHM] Password changed for: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Password change failed', { username, error: error.message });
      throw error;
    }
  }

  async upgradeAccount(username, newPlan) {
    try {
      logger.info(`[WHM] Upgrading account ${username} to plan: ${newPlan}`);

      const response = await whmClient.post('/json-api/upgrade_to_package', {
        user: username,
        pkg: newPlan,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        'UPDATE hosting_accounts SET plan = ?, upgraded_at = NOW() WHERE username = ?',
        [newPlan, username]
      );

      logger.info(`[WHM] Account upgraded: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Account upgrade failed', { username, newPlan, error: error.message });
      throw error;
    }
  }

  async setAccountLimit(username, feature, value) {
    try {
      logger.info(`[WHM] Setting limit for ${username}: ${feature} = ${value}`);

      const response = await whmClient.post('/json-api/limit_bandwidth', {
        user: username,
        bwlimit: value,
      });

      const result = await whmClient.parseResponse(response);
      logger.info(`[WHM] Limit set for: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Set account limit failed', {
        username,
        feature,
        error: error.message,
      });
      throw error;
    }
  }

  async syncAccountToDatabase(account) {
    try {
      const [existing] = await db.query(
        'SELECT id FROM hosting_accounts WHERE username = ?',
        [account.username]
      );

      const data = [
        account.username,
        account.domain,
        account.contactemail,
        account.plan,
        account.status,
        account.account_id,
      ];

      if (existing && existing.length > 0) {
        await db.query(
          `UPDATE hosting_accounts 
           SET domain = ?, email = ?, plan = ?, status = ?, account_id = ?, updated_at = NOW()
           WHERE username = ?`,
          [...data, account.username]
        );
      } else {
        await db.query(
          `INSERT INTO hosting_accounts (username, domain, email, plan, status, account_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          data
        );
      }
    } catch (error) {
      logger.error('[Database] Sync account failed', { username: account.username, error: error.message });
    }
  }

  async syncAccountsToDatabase(accounts) {
    try {
      for (const account of accounts) {
        await this.syncAccountToDatabase({
          username: account.user,
          domain: account.domain,
          contactemail: account.email,
          plan: account.plan,
          status: account.suspended === '1' ? 'suspended' : 'active',
        });
      }
    } catch (error) {
      logger.error('[Database] Sync accounts failed', { error: error.message });
    }
  }
}

module.exports = new AccountsService();
