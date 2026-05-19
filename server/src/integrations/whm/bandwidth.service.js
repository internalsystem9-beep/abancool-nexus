const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class BandwidthService {
  async getBandwidthUsage(username = null) {
    try {
      if (username) {
        logger.info(`[WHM] Getting bandwidth for account: ${username}`);
      } else {
        logger.info('[WHM] Getting bandwidth for all accounts');
      }

      const params = username ? { user: username } : {};
      const response = await whmClient.get('/json-api/showbw', params);
      const result = await whmClient.parseResponse(response);

      const bandwidthData = result.data || result;

      if (username) {
        await this.recordBandwidthSnapshot(username, bandwidthData);
      } else if (Array.isArray(bandwidthData)) {
        for (const data of bandwidthData) {
          await this.recordBandwidthSnapshot(data.acct, data);
        }
      }

      logger.info('[WHM] Bandwidth data retrieved');
      return bandwidthData;
    } catch (error) {
      logger.error('[WHM] Get bandwidth failed', { username, error: error.message });
      throw error;
    }
  }

  async recordBandwidthSnapshot(username, data) {
    try {
      const bandwidth = data.bandwidth || data.used || 0;
      const bwlimit = data.bwlimit || 'unlimited';
      const percentUsed = bwlimit !== 'unlimited' ? (bandwidth / bwlimit) * 100 : 0;

      await db.query(
        `INSERT INTO bandwidth_usage (username, used_gb, limit_gb, percent_used, snapshot_date)
         VALUES (?, ?, ?, ?, NOW())`,
        [username, bandwidth, bwlimit === 'unlimited' ? null : bwlimit, percentUsed]
      );

      if (percentUsed > 90 && bwlimit !== 'unlimited') {
        logger.warn(`[WHM] Bandwidth warning for ${username}: ${percentUsed.toFixed(2)}% used`);
        await this.createBandwidthAlert(username, percentUsed, bwlimit);
      }
    } catch (error) {
      logger.error('[Database] Record bandwidth snapshot failed', { username, error: error.message });
    }
  }

  async createBandwidthAlert(username, percentUsed, limit) {
    try {
      await db.query(
        `INSERT INTO bandwidth_alerts (username, percent_used, bandwidth_limit, alert_type, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [username, percentUsed, limit, 'high_usage']
      );
    } catch (error) {
      logger.error('[Database] Create bandwidth alert failed', { username, error: error.message });
    }
  }

  async getBandwidthHistory(username, days = 30) {
    try {
      logger.info(`[WHM] Getting bandwidth history for ${username} (${days} days)`);

      const [results] = await db.query(
        `SELECT used_gb, limit_gb, percent_used, snapshot_date 
         FROM bandwidth_usage 
         WHERE username = ? AND snapshot_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
         ORDER BY snapshot_date DESC`,
        [username, days]
      );

      return results || [];
    } catch (error) {
      logger.error('[Database] Get bandwidth history failed', { username, error: error.message });
      throw error;
    }
  }

  async resetBandwidth(username) {
    try {
      logger.info(`[WHM] Resetting bandwidth for: ${username}`);

      const response = await whmClient.post('/json-api/reset_bandwidth', {
        user: username,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE bandwidth_usage SET used_gb = 0 WHERE username = ?`,
        [username]
      );

      logger.info(`[WHM] Bandwidth reset for: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Reset bandwidth failed', { username, error: error.message });
      throw error;
    }
  }

  async getTopConsumers(limit = 10) {
    try {
      logger.info('[WHM] Getting top bandwidth consumers');

      const [results] = await db.query(
        `SELECT username, used_gb, limit_gb, percent_used, snapshot_date
         FROM bandwidth_usage
         WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM bandwidth_usage)
         ORDER BY percent_used DESC
         LIMIT ?`,
        [limit]
      );

      return results || [];
    } catch (error) {
      logger.error('[Database] Get top consumers failed', { error: error.message });
      throw error;
    }
  }

  async getAccountBandwidthStatus(username) {
    try {
      const bandwidthData = await this.getBandwidthUsage(username);

      const [latest] = await db.query(
        `SELECT * FROM bandwidth_usage WHERE username = ? ORDER BY snapshot_date DESC LIMIT 1`,
        [username]
      );

      return {
        current: bandwidthData,
        latest: latest ? latest[0] : null,
        history: await this.getBandwidthHistory(username, 7),
      };
    } catch (error) {
      logger.error('[WHM] Get account bandwidth status failed', { username, error: error.message });
      throw error;
    }
  }

  async setBandwidthLimit(username, limit) {
    try {
      logger.info(`[WHM] Setting bandwidth limit for ${username}: ${limit}`);

      const response = await whmClient.post('/json-api/limit_bandwidth', {
        user: username,
        bwlimit: limit,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE hosting_accounts SET bandwidth_limit = ? WHERE username = ?`,
        [limit, username]
      );

      logger.info(`[WHM] Bandwidth limit set for: ${username}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Set bandwidth limit failed', { username, limit, error: error.message });
      throw error;
    }
  }
}

module.exports = new BandwidthService();
