/**
 * Audit Service
 * Handles logging of all system actions for compliance and auditing
 */

const db = require("../config/db");

/**
 * Log an action to the audit log
 */
async function logAction(userId, action, entityType, entityId, details = null, ipAddress = null) {
  try {
    // Create audit_logs table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id BIGINT,
        details JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_entity_type (entity_type),
        INDEX idx_entity_id (entity_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insert audit log entry
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );

    return { success: true };
  } catch (err) {
    console.error("Audit logging error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Log project creation
 */
async function logProjectCreation(userId, projectId, projectData, ipAddress = null) {
  return logAction(userId, 'CREATE', 'project', projectId, {
    project_name: projectData.project_name,
    client_id: projectData.client_id,
    budget: projectData.budget,
    deadline: projectData.deadline
  }, ipAddress);
}

/**
 * Log project update
 */
async function logProjectUpdate(userId, projectId, changes, ipAddress = null) {
  return logAction(userId, 'UPDATE', 'project', projectId, changes, ipAddress);
}

/**
 * Log project status change
 */
async function logProjectStatusChange(userId, projectId, oldStatus, newStatus, ipAddress = null) {
  return logAction(userId, 'STATUS_CHANGE', 'project', projectId, {
    old_status: oldStatus,
    new_status: newStatus
  }, ipAddress);
}

/**
 * Log project deletion
 */
async function logProjectDeletion(userId, projectId, ipAddress = null) {
  return logAction(userId, 'DELETE', 'project', projectId, {}, ipAddress);
}

/**
 * Log team member assignment
 */
async function logTeamAssignment(userId, projectId, assignedUserId, role, ipAddress = null) {
  return logAction(userId, 'ASSIGN_TEAM', 'project', projectId, {
    assigned_user_id: assignedUserId,
    role: role
  }, ipAddress);
}

/**
 * Log team member removal
 */
async function logTeamRemoval(userId, projectId, removedUserId, ipAddress = null) {
  return logAction(userId, 'REMOVE_TEAM', 'project', projectId, {
    removed_user_id: removedUserId
  }, ipAddress);
}

/**
 * Log deployment URL addition
 */
async function logDeployment(userId, projectId, deploymentUrl, ipAddress = null) {
  return logAction(userId, 'ADD_DEPLOYMENT', 'project', projectId, {
    deployment_url: deploymentUrl
  }, ipAddress);
}

/**
 * Log budget exceeded
 */
async function logBudgetExceeded(projectId, budget, spent, ipAddress = null) {
  return logAction(null, 'BUDGET_EXCEEDED', 'project', projectId, {
    budget: budget,
    spent: spent,
    exceeded_by: spent - budget
  }, ipAddress);
}

/**
 * Get audit log for a project
 */
async function getProjectAuditLog(projectId, page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs 
       WHERE entity_type = 'project' AND entity_id = ?`,
      [projectId]
    );
    const total = countResult[0].total;

    // Get paginated audit logs
    const logs = await db.query(
      `SELECT 
        al.id, al.user_id, al.action, al.entity_type, al.entity_id,
        al.details, al.ip_address, al.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'project' AND al.entity_id = ?
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [projectId, limit, offset]
    );

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (err) {
    console.error("Get audit log error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get audit log for a user
 */
async function getUserAuditLog(userId, page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?`,
      [userId]
    );
    const total = countResult[0].total;

    // Get paginated audit logs
    const logs = await db.query(
      `SELECT 
        al.id, al.user_id, al.action, al.entity_type, al.entity_id,
        al.details, al.ip_address, al.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.user_id = ?
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (err) {
    console.error("Get user audit log error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  logAction,
  logProjectCreation,
  logProjectUpdate,
  logProjectStatusChange,
  logProjectDeletion,
  logTeamAssignment,
  logTeamRemoval,
  logDeployment,
  logBudgetExceeded,
  getProjectAuditLog,
  getUserAuditLog
};
