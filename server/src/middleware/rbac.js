/**
 * RBAC Middleware
 * Provides role-based access control decorators and permission checking
 */

const db = require("../config/db");

/**
 * Decorator to check if user has specific role(s)
 * Usage: requireRole('super_admin', 'admin')
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      // Get user roles from database
      const userRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [req.user.id]);
      const roles = userRoles.map((r) => r.role);

      // Check if user has any of the allowed roles
      const hasRole = roles.some((role) => allowedRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          error: "Forbidden - insufficient permissions",
        });
      }

      // Store roles in request for later use
      req.user.roles = roles;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Decorator to check if user has permission for a specific action
 * Usage: requirePermission('create_user', 'delete_user')
 */
function requirePermission(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      // Get user roles
      const userRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [req.user.id]);
      const roles = userRoles.map((r) => r.role);

      // Define role-permission mapping
      const rolePermissions = {
        super_admin: [
          "create_user",
          "read_user",
          "update_user",
          "delete_user",
          "manage_roles",
          "manage_clients",
          "manage_projects",
          "manage_hosting",
          "manage_domains",
          "manage_vps",
          "manage_vault",
          "manage_files",
          "manage_billing",
          "manage_payments",
          "manage_communications",
          "manage_tickets",
          "manage_automations",
          "view_audit_logs",
          "manage_system",
        ],
        admin: [
          "read_user",
          "update_user",
          "manage_clients",
          "manage_projects",
          "manage_hosting",
          "manage_domains",
          "manage_vps",
          "manage_files",
          "manage_billing",
          "manage_communications",
          "manage_tickets",
          "view_audit_logs",
        ],
        developer: [
          "read_user",
          "update_user",
          "read_projects",
          "update_projects",
          "manage_files",
          "read_vault",
          "read_tickets",
        ],
        support: [
          "read_user",
          "read_clients",
          "read_projects",
          "manage_tickets",
          "manage_communications",
          "read_vault",
        ],
        finance: [
          "read_user",
          "read_clients",
          "manage_billing",
          "manage_payments",
          "view_audit_logs",
        ],
        sales: [
          "read_user",
          "read_clients",
          "manage_clients",
          "read_projects",
          "manage_communications",
        ],
      };

      // Check if user has any of the required permissions
      let hasPermission = false;
      for (const role of roles) {
        const rolePerms = rolePermissions[role] || [];
        if (permissions.some((perm) => rolePerms.includes(perm))) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: "Forbidden - insufficient permissions",
        });
      }

      req.user.roles = roles;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user has permission for a specific action
 * Returns boolean
 */
async function checkPermission(userId, permission) {
  try {
    const userRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
    const roles = userRoles.map((r) => r.role);

    const rolePermissions = {
      super_admin: [
        "create_user",
        "read_user",
        "update_user",
        "delete_user",
        "manage_roles",
        "manage_clients",
        "manage_projects",
        "manage_hosting",
        "manage_domains",
        "manage_vps",
        "manage_vault",
        "manage_files",
        "manage_billing",
        "manage_payments",
        "manage_communications",
        "manage_tickets",
        "manage_automations",
        "view_audit_logs",
        "manage_system",
      ],
      admin: [
        "read_user",
        "update_user",
        "manage_clients",
        "manage_projects",
        "manage_hosting",
        "manage_domains",
        "manage_vps",
        "manage_files",
        "manage_billing",
        "manage_communications",
        "manage_tickets",
        "view_audit_logs",
      ],
      developer: [
        "read_user",
        "update_user",
        "read_projects",
        "update_projects",
        "manage_files",
        "read_vault",
        "read_tickets",
      ],
      support: [
        "read_user",
        "read_clients",
        "read_projects",
        "manage_tickets",
        "manage_communications",
        "read_vault",
      ],
      finance: [
        "read_user",
        "read_clients",
        "manage_billing",
        "manage_payments",
        "view_audit_logs",
      ],
      sales: [
        "read_user",
        "read_clients",
        "manage_clients",
        "read_projects",
        "manage_communications",
      ],
    };

    for (const role of roles) {
      const rolePerms = rolePermissions[role] || [];
      if (rolePerms.includes(permission)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
async function getUserPermissions(userId) {
  try {
    const userRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
    const roles = userRoles.map((r) => r.role);

    const rolePermissions = {
      super_admin: [
        "create_user",
        "read_user",
        "update_user",
        "delete_user",
        "manage_roles",
        "manage_clients",
        "manage_projects",
        "manage_hosting",
        "manage_domains",
        "manage_vps",
        "manage_vault",
        "manage_files",
        "manage_billing",
        "manage_payments",
        "manage_communications",
        "manage_tickets",
        "manage_automations",
        "view_audit_logs",
        "manage_system",
      ],
      admin: [
        "read_user",
        "update_user",
        "manage_clients",
        "manage_projects",
        "manage_hosting",
        "manage_domains",
        "manage_vps",
        "manage_files",
        "manage_billing",
        "manage_communications",
        "manage_tickets",
        "view_audit_logs",
      ],
      developer: [
        "read_user",
        "update_user",
        "read_projects",
        "update_projects",
        "manage_files",
        "read_vault",
        "read_tickets",
      ],
      support: [
        "read_user",
        "read_clients",
        "read_projects",
        "manage_tickets",
        "manage_communications",
        "read_vault",
      ],
      finance: [
        "read_user",
        "read_clients",
        "manage_billing",
        "manage_payments",
        "view_audit_logs",
      ],
      sales: [
        "read_user",
        "read_clients",
        "manage_clients",
        "read_projects",
        "manage_communications",
      ],
    };

    const permissions = new Set();
    for (const role of roles) {
      const rolePerms = rolePermissions[role] || [];
      rolePerms.forEach((perm) => permissions.add(perm));
    }

    return Array.from(permissions);
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

module.exports = {
  requireRole,
  requirePermission,
  checkPermission,
  getUserPermissions,
};
