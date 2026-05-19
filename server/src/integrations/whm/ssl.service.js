const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class SSLService {
  async listSSLCertificates(username = null) {
    try {
      if (username) {
        logger.info(`[WHM] Listing SSL certificates for: ${username}`);
      } else {
        logger.info('[WHM] Listing all SSL certificates');
      }

      const params = username ? { user: username } : {};
      const response = await whmClient.get('/json-api/fetch_ssl_vhosts', params);
      const result = await whmClient.parseResponse(response);

      const certs = result.data?.vhosts || [];

      await this.syncSSLToDatabase(certs, username);

      logger.info(`[WHM] Retrieved ${certs.length} SSL certificates`);
      return certs;
    } catch (error) {
      logger.error('[WHM] List SSL certificates failed', { username, error: error.message });
      throw error;
    }
  }

  async getSSLCertificate(domain) {
    try {
      logger.info(`[WHM] Getting SSL certificate for: ${domain}`);

      const allCerts = await this.listSSLCertificates();
      const cert = allCerts.find((c) => c.domain === domain || c.ip === domain);

      if (!cert) {
        throw new Error(`SSL certificate not found for: ${domain}`);
      }

      return cert;
    } catch (error) {
      logger.error('[WHM] Get SSL certificate failed', { domain, error: error.message });
      throw error;
    }
  }

  async installSSLCertificate(username, domain, cert, key, cabundle = '') {
    try {
      logger.info(`[WHM] Installing SSL certificate for ${domain} (${username})`);

      const response = await whmClient.post('/json-api/install_ssl', {
        user: username,
        domain,
        cert,
        key,
        cab: cabundle,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO ssl_certificates (username, domain, certificate, private_key, ca_bundle, installed_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [username, domain, cert, key, cabundle]
      );

      logger.info(`[WHM] SSL certificate installed: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Install SSL certificate failed', { username, domain, error: error.message });
      throw error;
    }
  }

  async generateCSR(username, domain, countryCode = 'US', state = '', city = '', organization = '') {
    try {
      logger.info(`[WHM] Generating CSR for ${domain}`);

      const response = await whmClient.post('/json-api/ssl_gencrt', {
        user: username,
        domain,
        country: countryCode,
        state,
        city,
        co: organization,
        hosts: domain,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `INSERT INTO ssl_csrs (username, domain, csr, private_key, generated_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [username, domain, result.data?.csr, result.data?.key]
      );

      logger.info(`[WHM] CSR generated: ${domain}`);
      return result.data;
    } catch (error) {
      logger.error('[WHM] Generate CSR failed', { username, domain, error: error.message });
      throw error;
    }
  }

  async deleteSSLCertificate(username, domain) {
    try {
      logger.info(`[WHM] Deleting SSL certificate: ${domain}`);

      const response = await whmClient.post('/json-api/delete_ssl', {
        user: username,
        domain,
      });

      const result = await whmClient.parseResponse(response);

      await db.query(
        `UPDATE ssl_certificates SET deleted_at = NOW() WHERE username = ? AND domain = ?`,
        [username, domain]
      );

      logger.info(`[WHM] SSL certificate deleted: ${domain}`);
      return result;
    } catch (error) {
      logger.error('[WHM] Delete SSL certificate failed', { username, domain, error: error.message });
      throw error;
    }
  }

  async getSSLStatus(username) {
    try {
      logger.info(`[WHM] Getting SSL status for: ${username}`);

      const [certs] = await db.query(
        `SELECT domain, installed_at, expires_at, status FROM ssl_certificates WHERE username = ? AND deleted_at IS NULL`,
        [username]
      );

      const expiringCerts = (certs || []).filter((cert) => {
        if (!cert.expires_at) return false;
        const daysUntilExpiry = Math.floor(
          (new Date(cert.expires_at) - new Date()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30;
      });

      if (expiringCerts.length > 0) {
        logger.warn(`[WHM] ${expiringCerts.length} SSL certificate(s) expiring soon for ${username}`);
      }

      return {
        totalCertificates: (certs || []).length,
        expiringCertificates: expiringCerts.length,
        certificates: certs || [],
      };
    } catch (error) {
      logger.error('[WHM] Get SSL status failed', { username, error: error.message });
      throw error;
    }
  }

  async syncSSLToDatabase(certs, username = null) {
    try {
      for (const cert of certs) {
        const [existing] = await db.query(
          'SELECT id FROM ssl_certificates WHERE domain = ?',
          [cert.domain]
        );

        const certUsername = username || cert.user || 'unknown';
        const expiresAt = cert.expiration_date ? new Date(cert.expiration_date * 1000) : null;

        if (existing && existing.length > 0) {
          await db.query(
            `UPDATE ssl_certificates 
             SET status = ?, expires_at = ?, updated_at = NOW()
             WHERE domain = ?`,
            [cert.ssl ? 'active' : 'inactive', expiresAt, cert.domain]
          );
        } else {
          await db.query(
            `INSERT INTO ssl_certificates (username, domain, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [certUsername, cert.domain, cert.ssl ? 'active' : 'inactive', expiresAt]
          );
        }
      }
    } catch (error) {
      logger.error('[Database] Sync SSL certificates failed', { error: error.message });
    }
  }

  async checkExpiringCertificates() {
    try {
      const [expiring] = await db.query(
        `SELECT username, domain, expires_at FROM ssl_certificates 
         WHERE expires_at IS NOT NULL 
         AND expires_at <= DATE_ADD(NOW(), INTERVAL 30 DAY)
         AND deleted_at IS NULL`
      );

      for (const cert of expiring || []) {
        await db.query(
          `INSERT INTO ssl_alerts (username, domain, alert_type, message, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [cert.username, cert.domain, 'expiring', `SSL certificate expires on ${cert.expires_at}`]
        );
      }

      logger.info(`[WHM] SSL expiry check completed, found ${(expiring || []).length} expiring certs`);
      return expiring || [];
    } catch (error) {
      logger.error('[Database] Check expiring certificates failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SSLService();
