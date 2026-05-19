const db = require("../config/db");
const { validateRequired, validateString } = require("../lib/validators");
const { getErrorMessage } = require("../lib/errors");

// ==================== AUDIT LOG FUNCTIONS ====================

/**
 * Get audit logs with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, action, entity_type, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    if (action) {
      whereClause += " AND action LIKE ?";
      params.push(`%${action}%`);
    }

    if (entity_type) {
      whereClause += " AND entity_type = ?";
      params.push(entity_type);
    }

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get audit logs
    const logs = await db.query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get single audit log details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAuditLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await db.query(`SELECT * FROM audit_logs WHERE id = ?`, [id]);

    if (log.length === 0) {
      return res.status(404).json({ error: "Audit log not found" });
    }

    res.json({
      success: true,
      data: log[0],
    });
  } catch (error) {
    console.error("Get audit log details error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Search audit logs with advanced filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchAuditLogs = async (req, res) => {
  try {
    const { query, page = 1, limit = 20, filters = {} } = req.body;
    const offset = (page - 1) * limit;

    if (!query || !validateString(query, 1, 200)) {
      return res.status(400).json({ error: "Search query is required and must be 1-200 characters" });
    }

    let whereClause = "WHERE (action LIKE ? OR entity_type LIKE ? OR changes LIKE ?)";
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    // Apply additional filters
    if (filters.user_id) {
      whereClause += " AND user_id = ?";
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      whereClause += " AND created_at >= ?";
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      whereClause += " AND created_at <= ?";
      params.push(filters.end_date);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get search results
    const results = await db.query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Search audit logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get audit statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAuditStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateWhereClause = "";
    const dateParams = [];

    if (start_date) {
      dateWhereClause += " AND created_at >= ?";
      dateParams.push(start_date);
    }

    if (end_date) {
      dateWhereClause += " AND created_at <= ?";
      dateParams.push(end_date);
    }

    // Overall stats
    const overallStats = await db.query(
      `SELECT COUNT(*) as total_logs FROM audit_logs WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    // Actions breakdown
    const actionStats = await db.query(
      `SELECT action, COUNT(*) as count FROM audit_logs WHERE 1=1 ${dateWhereClause}
       GROUP BY action ORDER BY count DESC LIMIT 10`,
      dateParams
    );

    // Entity types breakdown
    const entityStats = await db.query(
      `SELECT entity_type, COUNT(*) as count FROM audit_logs WHERE 1=1 ${dateWhereClause}
       GROUP BY entity_type ORDER BY count DESC`,
      dateParams
    );

    // Top users
    const userStats = await db.query(
      `SELECT user_id, COUNT(*) as action_count FROM audit_logs WHERE 1=1 ${dateWhereClause}
       GROUP BY user_id ORDER BY action_count DESC LIMIT 10`,
      dateParams
    );

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        by_action: actionStats,
        by_entity_type: entityStats,
        top_users: userStats,
      },
    });
  } catch (error) {
    console.error("Get audit stats error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== ACTIVITY LOG FUNCTIONS ====================

/**
 * Get activity logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, activity_type, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    if (activity_type) {
      whereClause += " AND activity_type = ?";
      params.push(activity_type);
    }

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM activity_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get activity logs
    const logs = await db.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get activity logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get activity statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getActivityStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateWhereClause = "";
    const dateParams = [];

    if (start_date) {
      dateWhereClause += " AND created_at >= ?";
      dateParams.push(start_date);
    }

    if (end_date) {
      dateWhereClause += " AND created_at <= ?";
      dateParams.push(end_date);
    }

    // Overall stats
    const overallStats = await db.query(
      `SELECT COUNT(*) as total_activities FROM activity_logs WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    // Activity types breakdown
    const activityTypeStats = await db.query(
      `SELECT activity_type, COUNT(*) as count FROM activity_logs WHERE 1=1 ${dateWhereClause}
       GROUP BY activity_type ORDER BY count DESC`,
      dateParams
    );

    // Top active users
    const userStats = await db.query(
      `SELECT user_id, COUNT(*) as activity_count FROM activity_logs WHERE 1=1 ${dateWhereClause}
       GROUP BY user_id ORDER BY activity_count DESC LIMIT 10`,
      dateParams
    );

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        by_activity_type: activityTypeStats,
        top_active_users: userStats,
      },
    });
  } catch (error) {
    console.error("Get activity stats error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== USER ACTIVITY FUNCTIONS ====================

/**
 * Get user activity timeline
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserActivityTimeline = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 20, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE user_id = ?";
    const params = [user_id];

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM activity_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get user's activity timeline
    const timeline = await db.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: timeline,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user activity timeline error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get user's audit trail
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserAuditTrail = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?`, [user_id]);
    const total = countResult[0].total;

    // Get user's audit trail
    const trail = await db.query(
      `SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [user_id, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: trail,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user audit trail error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get user activity summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserActivitySummary = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Total activities
    const totalActivities = await db.query(
      `SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?`,
      [user_id]
    );

    // Activities by type
    const activitiesByType = await db.query(
      `SELECT activity_type, COUNT(*) as count FROM activity_logs WHERE user_id = ?
       GROUP BY activity_type`,
      [user_id]
    );

    // Last activity
    const lastActivity = await db.query(
      `SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [user_id]
    );

    // Total audit events
    const auditEvents = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?`,
      [user_id]
    );

    res.json({
      success: true,
      data: {
        user_id,
        total_activities: totalActivities[0].total,
        total_audit_events: auditEvents[0].total,
        activities_by_type: activitiesByType,
        last_activity: lastActivity[0] || null,
      },
    });
  } catch (error) {
    console.error("Get user activity summary error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== SENSITIVE DATA TRACKING ====================

/**
 * Get sensitive data access logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSensitiveDataAccessLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, resource_type, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE entity_type IN ('password_vault', 'payment', 'user_credentials')";
    const params = [];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    if (resource_type) {
      whereClause += " AND entity_type = ?";
      params.push(resource_type);
    }

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get sensitive data access logs
    const logs = await db.query(
      `SELECT id, user_id, action, entity_type, entity_id, ip_address, created_at FROM audit_logs 
       ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get sensitive data access logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== LOG CLEANUP & ARCHIVAL ====================

/**
 * Cleanup old audit logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.cleanupOldAuditLogs = async (req, res) => {
  try {
    const { days_to_keep = 90 } = req.body;
    const userId = req.user.id;

    if (!days_to_keep || days_to_keep < 1) {
      return res.status(400).json({ error: "Days to keep must be at least 1" });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_to_keep);

    // Get count of logs to delete
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at < ?`,
      [cutoffDate]
    );

    const logsToDelete = countResult[0].count;

    // Delete old logs
    await db.query(`DELETE FROM audit_logs WHERE created_at < ?`, [cutoffDate]);

    // Log the cleanup action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
       VALUES (?, 'cleanup_old_logs', 'audit_logs', ?, NOW())`,
      [userId, JSON.stringify({ logs_deleted: logsToDelete, days_to_keep })]
    );

    res.json({
      success: true,
      data: {
        logs_deleted: logsToDelete,
        cutoff_date: cutoffDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Cleanup old audit logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Cleanup old activity logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.cleanupOldActivityLogs = async (req, res) => {
  try {
    const { days_to_keep = 90 } = req.body;
    const userId = req.user.id;

    if (!days_to_keep || days_to_keep < 1) {
      return res.status(400).json({ error: "Days to keep must be at least 1" });
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_to_keep);

    // Get count of logs to delete
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM activity_logs WHERE created_at < ?`,
      [cutoffDate]
    );

    const logsToDelete = countResult[0].count;

    // Delete old logs
    await db.query(`DELETE FROM activity_logs WHERE created_at < ?`, [cutoffDate]);

    // Log the cleanup action
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
       VALUES (?, 'cleanup_activity_logs', 'activity_logs', ?, NOW())`,
      [userId, JSON.stringify({ logs_deleted: logsToDelete, days_to_keep })]
    );

    res.json({
      success: true,
      data: {
        logs_deleted: logsToDelete,
        cutoff_date: cutoffDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Cleanup old activity logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== LOG EXPORT ====================

/**
 * Export audit logs as JSON
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.exportAuditLogs = async (req, res) => {
  try {
    const { start_date, end_date, user_id, action, entity_type } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    if (action) {
      whereClause += " AND action LIKE ?";
      params.push(`%${action}%`);
    }

    if (entity_type) {
      whereClause += " AND entity_type = ?";
      params.push(entity_type);
    }

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get all logs matching criteria
    const logs = await db.query(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC`, params);

    // Set response headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="audit_logs_${Date.now()}.json"`);

    res.json({
      success: true,
      export_date: new Date().toISOString(),
      total_records: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Export audit logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Export activity logs as JSON
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.exportActivityLogs = async (req, res) => {
  try {
    const { start_date, end_date, user_id, activity_type } = req.query;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (user_id) {
      whereClause += " AND user_id = ?";
      params.push(user_id);
    }

    if (activity_type) {
      whereClause += " AND activity_type = ?";
      params.push(activity_type);
    }

    if (start_date) {
      whereClause += " AND created_at >= ?";
      params.push(start_date);
    }

    if (end_date) {
      whereClause += " AND created_at <= ?";
      params.push(end_date);
    }

    // Get all logs matching criteria
    const logs = await db.query(`SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC`, params);

    // Set response headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="activity_logs_${Date.now()}.json"`);

    res.json({
      success: true,
      export_date: new Date().toISOString(),
      total_records: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Export activity logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== COMPLIANCE & REPORTING ====================

/**
 * Get compliance report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getComplianceReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateWhereClause = "";
    const dateParams = [];

    if (start_date) {
      dateWhereClause += " AND created_at >= ?";
      dateParams.push(start_date);
    }

    if (end_date) {
      dateWhereClause += " AND created_at <= ?";
      dateParams.push(end_date);
    }

    // Failed authentications
    const failedAuth = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'auth_failed' ${dateWhereClause}`,
      dateParams
    );

    // Unauthorized access attempts
    const unauthorizedAccess = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action LIKE 'unauthorized_%' ${dateWhereClause}`,
      dateParams
    );

    // Sensitive data access
    const sensitiveAccess = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE entity_type IN ('password_vault', 'payment', 'user_credentials') ${dateWhereClause}`,
      dateParams
    );

    // Data modifications
    const dataModifications = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action IN ('create', 'update', 'delete') ${dateWhereClause}`,
      dateParams
    );

    // User actions
    const userActions = await db.query(
      `SELECT COUNT(DISTINCT user_id) as total_users, COUNT(*) as total_actions 
       FROM audit_logs WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    res.json({
      success: true,
      data: {
        report_period: {
          start_date,
          end_date,
        },
        security_metrics: {
          failed_authentications: failedAuth[0].count,
          unauthorized_access_attempts: unauthorizedAccess[0].count,
          sensitive_data_accesses: sensitiveAccess[0].count,
        },
        data_integrity: {
          data_modifications: dataModifications[0].count,
        },
        user_activity: {
          total_active_users: userActions[0].total_users,
          total_user_actions: userActions[0].total_actions,
        },
      },
    });
  } catch (error) {
    console.error("Get compliance report error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

module.exports = exports;
