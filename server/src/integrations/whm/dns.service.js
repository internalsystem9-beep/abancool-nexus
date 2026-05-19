const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class DNSService {
  async createDNSZone(domain, nameserver1, nameserver2, nameserver3 = '', nameserver4 = '') {
    try {
      logger.info(`[WHM] Creating DNS zone for: ${domain}`);

      const params = {
        domain,
        ns1ip: nameserver1,
        ns2ip: nameserver2,
      };

      if (nameserver3) params.ns3ip = nameserver3;
      if (nameserver4) params.ns4ip = nameserver4;

      const response = await whmClient.post('/json-api/create-dns', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO dns_zones (domain, nameserver1, nameserver2, nameserver3, nameserver4, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [domain, nameserver1, nameserver2, nameserver3, nameserver4]
      );

      logger.info(`[WHM] DNS zone created: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Create DNS zone failed', { domain, error: error.message });
      throw error;
    }
  }

  async editDNSZone(domain, updates) {
    try {
      logger.info(`[WHM] Editing DNS zone: ${domain}`);

      const params = {
        domain,
        ...updates,
      };

      const response = await whmClient.post('/json-api/edit-dns', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE dns_zones SET updated_at = NOW() WHERE domain = ?`,
        [domain]
      );

      logger.info(`[WHM] DNS zone edited: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Edit DNS zone failed', { domain, error: error.message });
      throw error;
    }
  }

  async deleteDNSZone(domain) {
    try {
      logger.info(`[WHM] Deleting DNS zone: ${domain}`);

      const response = await whmClient.post('/json-api/kill-dns', {
        domain,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE dns_zones SET deleted_at = NOW() WHERE domain = ?`,
        [domain]
      );

      logger.info(`[WHM] DNS zone deleted: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Delete DNS zone failed', { domain, error: error.message });
      throw error;
    }
  }

  async parkDNSZone(domain, target) {
    try {
      logger.info(`[WHM] Parking DNS zone ${domain} to ${target}`);

      const response = await whmClient.post('/json-api/park-dns', {
        domain,
        ip: target,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO dns_parked (domain, target, parked_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE target = ?, parked_at = NOW()`,
        [domain, target, target]
      );

      logger.info(`[WHM] DNS zone parked: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Park DNS zone failed', { domain, target, error: error.message });
      throw error;
    }
  }

  async createMXRecord(domain, priority, exchange) {
    try {
      logger.info(`[WHM] Creating MX record for ${domain} -> ${exchange}`);

      const params = {
        domain,
        preference: priority,
        exchange,
      };

      const response = await whmClient.post('/json-api/add_mx', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO dns_records (domain, record_type, priority, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [domain, 'MX', priority, exchange]
      );

      logger.info(`[WHM] MX record created: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Create MX record failed', { domain, exchange, error: error.message });
      throw error;
    }
  }

  async editMXRecord(domain, priority, exchange, newPriority, newExchange) {
    try {
      logger.info(`[WHM] Editing MX record for ${domain}`);

      const params = {
        domain,
        oldpreference: priority,
        oldexchange: exchange,
        preference: newPriority,
        exchange: newExchange,
      };

      const response = await whmClient.post('/json-api/edit_mx', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE dns_records SET priority = ?, value = ?, updated_at = NOW()
         WHERE domain = ? AND record_type = 'MX' AND priority = ? AND value = ?`,
        [newPriority, newExchange, domain, priority, exchange]
      );

      logger.info(`[WHM] MX record edited: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Edit MX record failed', { domain, error: error.message });
      throw error;
    }
  }

  async deleteMXRecord(domain, priority, exchange) {
    try {
      logger.info(`[WHM] Deleting MX record for ${domain}`);

      const params = {
        domain,
        preference: priority,
        exchange,
      };

      const response = await whmClient.post('/json-api/delete_mx', params);
      const result = await whmClient.parseResponse(response);

      await db.query(
        `DELETE FROM dns_records WHERE domain = ? AND record_type = 'MX' AND priority = ? AND value = ?`,
        [domain, priority, exchange]
      );

      logger.info(`[WHM] MX record deleted: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Delete MX record failed', { domain, error: error.message });
      throw error;
    }
  }

  async listDNSZones(username = null) {
    try {
      if (username) {
        logger.info(`[WHM] Listing DNS zones for: ${username}`);
      } else {
        logger.info('[WHM] Listing all DNS zones');
      }

      const params = username ? { user: username } : {};
      const response = await whmClient.get('/json-api/listdns', params);
      const result = await whmClient.parseResponse(response);

      const zones = result.data?.zones || [];

      for (const zone of zones) {
        await db.query(
          `INSERT INTO dns_zones (domain, created_at)
           VALUES (?, NOW())
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [zone.domain || zone]
        );
      }

      logger.info(`[WHM] Retrieved ${zones.length} DNS zones`);
      return zones;
    } catch (error) {
      logger.error('[WHM] List DNS zones failed', { username, error: error.message });
      throw error;
    }
  }

  async getDNSRecords(domain) {
    try {
      const [records] = await db.query(
        `SELECT record_type, value, priority FROM dns_records WHERE domain = ? AND deleted_at IS NULL`,
        [domain]
      );

      return records || [];
    } catch (error) {
      logger.error('[Database] Get DNS records failed', { domain, error: error.message });
      throw error;
    }
  }

  async createCNAMERecord(domain, name, target) {
    try {
      logger.info(`[WHM] Creating CNAME record: ${name}.${domain} -> ${target}`);

      await db.query(
        `INSERT INTO dns_records (domain, record_type, name, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [domain, 'CNAME', name, target]
      );

      logger.info(`[WHM] CNAME record created: ${name}.${domain}`);
      return { domain, name, target, type: 'CNAME' };
    } catch (error) {
      logger.error('[Database] Create CNAME record failed', { domain, name, error: error.message });
      throw error;
    }
  }

  async createARecord(domain, name, ipAddress) {
    try {
      logger.info(`[WHM] Creating A record: ${name}.${domain} -> ${ipAddress}`);

      await db.query(
        `INSERT INTO dns_records (domain, record_type, name, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [domain, 'A', name, ipAddress]
      );

      logger.info(`[WHM] A record created: ${name}.${domain}`);
      return { domain, name, value: ipAddress, type: 'A' };
    } catch (error) {
      logger.error('[Database] Create A record failed', { domain, name, error: error.message });
      throw error;
    }
  }

  async createTXTRecord(domain, name, value) {
    try {
      logger.info(`[WHM] Creating TXT record: ${name}.${domain}`);

      await db.query(
        `INSERT INTO dns_records (domain, record_type, name, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [domain, 'TXT', name, value]
      );

      logger.info(`[WHM] TXT record created: ${name}.${domain}`);
      return { domain, name, value, type: 'TXT' };
    } catch (error) {
      logger.error('[Database] Create TXT record failed', { domain, name, error: error.message });
      throw error;
    }
  }
}

module.exports = new DNSService();
