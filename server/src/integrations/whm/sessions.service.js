const whmClient = require('./whm.client');
const logger = require('../../middleware/logger');
const db = require('../../config/db');

class SessionsService {
  async createLoginSession(username, redirectUrl = null) {
    try {
      logger.info(`[WHM] Creating login session for: ${username}`);

      const params = {
        user: username,
        domain: username,
      };

      if (redirectUrl) {
        params.redirect_url = redirectUrl;
      }

      const response = await whmClient.post('/json-api/create_user_session', params);
      const result = await whmClient.parseResponse(response);

      const sessionUrl = result.data?.url || `${process.env.WHM_HOST}${result.data?.path}`;
      const sessionHash = result.data?.session_id || result.data?.hash;

      await this.recordSession({
        username,
        session_hash: sessionHash,
        redirect_url: redirectUrl,
        session_url: sessionUrl,
      });

      logger.info(`[WHM] Login session created for: ${username}`);
      return {
        username,
        url: sessionUrl,
        sessionId: sessionHash,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('[WHM] Create login session failed', { username, error: error.message });
      throw error;
    }
  }

  async createAdminSession(redirectUrl = null) {
    try {
      logger.info('[WHM] Creating admin login session');

      const params = {};

      if (redirectUrl) {
        params.redirect_url = redirectUrl;
      }

      const response = await whmClient.post('/json-api/create_admin_session', params);
      const result = await whmClient.parseResponse(response);

      const sessionUrl = result.data?.url || `${process.env.WHM_HOST}${result.data?.path}`;

      logger.info('[WHM] Admin login session created');
      return {
        url: sessionUrl,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('[WHM] Create admin session failed', { error: error.message });
      throw error;
    }
  }

  async recordSession(sessionData) {
    try {
      await db.query(
        `INSERT INTO login_sessions (username, session_hash, redirect_url, session_url, expires_at, created_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())`,
        [sessionData.username, sessionData.session_hash, sessionData.redirect_url, sessionData.session_url]
      );
    } catch (error) {
      logger.error('[Database] Record session failed', { username: sessionData.username, error: error.message });
    }
  }

  async validateSession(sessionHash) {
    try {
      const [sessions] = await db.query(
        `SELECT * FROM login_sessions 
         WHERE session_hash = ? 
         AND expires_at > NOW()
         LIMIT 1`,
        [sessionHash]
      );

      if (!sessions || sessions.length === 0) {
        return false;
      }

      return sessions[0];
    } catch (error) {
      logger.error('[Database] Validate session failed', { error: error.message });
      throw error;
    }
  }

  async revokeSession(sessionHash) {
    try {
      logger.info('[WHM] Revoking session');

      await db.query(
        `UPDATE login_sessions SET revoked_at = NOW() WHERE session_hash = ?`,
        [sessionHash]
      );

      logger.info('[WHM] Session revoked');
    } catch (error) {
      logger.error('[Database] Revoke session failed', { error: error.message });
      throw error;
    }
  }

  async cleanupExpiredSessions() {
    try {
      const result = await db.query(
        `DELETE FROM login_sessions WHERE expires_at < NOW()`
      );

      logger.info(`[Database] Cleaned up expired sessions`);
      return result;
    } catch (error) {
      logger.error('[Database] Cleanup expired sessions failed', { error: error.message });
      throw error;
    }
  }

  async getSessionHistory(username, limit = 50) {
    try {
      const [sessions] = await db.query(
        `SELECT session_hash, redirect_url, created_at, expires_at, revoked_at
         FROM login_sessions 
         WHERE username = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [username, limit]
      );

      return sessions || [];
    } catch (error) {
      logger.error('[Database] Get session history failed', { username, error: error.message });
      throw error;
    }
  }

  async generateSSOLink(username, returnUrl = null) {
    try {
      logger.info(`[WHM] Generating SSO link for: ${username}`);

      const session = await this.createLoginSession(username, returnUrl);

      const ssoLink = `${process.env.APP_URL}/api/hosting/sso?hash=${session.sessionId}&return=${encodeURIComponent(returnUrl || process.env.APP_URL)}`;

      await db.query(
        `INSERT INTO sso_links (username, sso_hash, return_url, created_at, expires_at)
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
        [username, session.sessionId, returnUrl]
      );

      logger.info(`[WHM] SSO link generated for: ${username}`);
      return ssoLink;
    } catch (error) {
      logger.error('[WHM] Generate SSO link failed', { username, error: error.message });
      throw error;
    }
  }

  async validateSSOLink(ssoHash) {
    try {
      const [links] = await db.query(
        `SELECT * FROM sso_links 
         WHERE sso_hash = ? 
         AND expires_at > NOW()
         AND used_at IS NULL
         LIMIT 1`,
        [ssoHash]
      );

      if (!links || links.length === 0) {
        throw new Error('Invalid or expired SSO link');
      }

      return links[0];
    } catch (error) {
      logger.error('[Database] Validate SSO link failed', { error: error.message });
      throw error;
    }
  }

  async consumeSSOLink(ssoHash) {
    try {
      await db.query(
        `UPDATE sso_links SET used_at = NOW() WHERE sso_hash = ?`,
        [ssoHash]
      );
    } catch (error) {
      logger.error('[Database] Consume SSO link failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SessionsService();
