/**
 * Users Controller
 * Handles user management, role assignment, and RBAC operations
 */

const db = require("../config/db");
const { signToken } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Predefined roles
const ROLES = ["super_admin", "admin", "developer", "support", "finance", "sales"];

/**
 * Create a new user (Super Admin only)
 * POST /api/users
 */
async function create(req, res, next) {
  try {
    // Check if requester is Super Admin
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin can create users",
      });
    }

    const { email, password, first_name, last_name, phone, roles } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    // Check if user already exists
    const existingUser = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists",
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [email, password_hash, first_name || null, last_name || null, phone || null]
    );

    const userId = result.insertId;

    // Assign roles
    const assignedRoles = roles && Array.isArray(roles) ? roles : ["developer"];
    for (const role of assignedRoles) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role: ${role}`,
        });
      }

      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, ?, ?)`,
        [userId, role, req.user.id]
      );
    }

    // Log audit
    await logAudit(req.user.id, "user_created", "users", userId, null, { email, roles: assignedRoles }, req);

    // Fetch created user with roles
    const user = await getUserWithRoles(userId);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all users with pagination
 * GET /api/users?page=1&limit=10&search=&status=active&role=
 */
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const role = req.query.role || "";

    let whereClause = "WHERE u.deleted_at IS NULL";
    const params = [];

    if (search) {
      whereClause += " AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status && ["active", "inactive", "suspended"].includes(status)) {
      whereClause += " AND u.status = ?";
      params.push(status);
    }

    if (role && ROLES.includes(role)) {
      whereClause += " AND ur.role = ?";
      params.push(role);
    }

    // Get total count
    let countQuery = `SELECT COUNT(DISTINCT u.id) as total FROM users u`;
    if (role) {
      countQuery += ` LEFT JOIN user_roles ur ON u.id = ur.user_id`;
    }
    countQuery += ` ${whereClause}`;

    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;

    // Get paginated users
    let query = `
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, 
             u.status, u.last_login_at, u.created_at, u.updated_at
      FROM users u
    `;

    if (role) {
      query += ` LEFT JOIN user_roles ur ON u.id = ur.user_id`;
    }

    query += ` ${whereClause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const users = await db.query(query, params);

    // Get roles for each user
    for (const user of users) {
      const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [user.id]);
      user.roles = roles.map((r) => r.role);
    }

    res.json({
      success: true,
      data: users,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user details
 * GET /api/users/:id
 */
async function get(req, res, next) {
  try {
    const userId = req.params.id;

    const user = await getUserWithRoles(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 * PUT /api/users/:id
 */
async function update(req, res, next) {
  try {
    const userId = req.params.id;
    const { first_name, last_name, phone, avatar_url } = req.body;

    // Check authorization - user can update own profile or Super Admin can update anyone
    if (req.user.id !== parseInt(userId) && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "You can only update your own profile",
      });
    }

    // Get current user data for audit
    const currentUser = await db.query("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (currentUser.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const oldValues = {
      first_name: currentUser[0].first_name,
      last_name: currentUser[0].last_name,
      phone: currentUser[0].phone,
      avatar_url: currentUser[0].avatar_url,
    };

    // Update user
    await db.query(
      `UPDATE users SET first_name = ?, last_name = ?, phone = ?, avatar_url = ?, updated_at = NOW()
       WHERE id = ?`,
      [first_name || null, last_name || null, phone || null, avatar_url || null, userId]
    );

    // Log audit
    const newValues = { first_name, last_name, phone, avatar_url };
    await logAudit(req.user.id, "user_updated", "users", userId, oldValues, newValues, req);

    const user = await getUserWithRoles(userId);

    res.json({
      success: true,
      message: "User profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user roles
 * PUT /api/users/:id/roles
 */
async function updateRoles(req, res, next) {
  try {
    const userId = req.params.id;
    const { roles } = req.body;

    // Check if requester is Super Admin
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin can update user roles",
      });
    }

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one role is required",
      });
    }

    // Validate all roles
    for (const role of roles) {
      if (!ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Invalid role: ${role}`,
        });
      }
    }

    // Check user exists
    const user = await db.query("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get old roles for audit
    const oldRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
    const oldRolesList = oldRoles.map((r) => r.role);

    // Delete existing roles
    await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);

    // Assign new roles
    for (const role of roles) {
      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, ?, ?)`,
        [userId, role, req.user.id]
      );
    }

    // Log audit
    await logAudit(req.user.id, "user_roles_updated", "users", userId, { roles: oldRolesList }, { roles }, req);

    const updatedUser = await getUserWithRoles(userId);

    res.json({
      success: true,
      message: "User roles updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Soft-delete user
 * DELETE /api/users/:id
 */
async function remove(req, res, next) {
  try {
    const userId = req.params.id;

    // Check if requester is Super Admin
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin can delete users",
      });
    }

    // Prevent deleting self
    if (req.user.id === parseInt(userId)) {
      return res.status(400).json({
        success: false,
        error: "You cannot delete your own account",
      });
    }

    // Check user exists
    const user = await db.query("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Soft delete
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = ?", [userId]);

    // Log audit
    await logAudit(req.user.id, "user_deleted", "users", userId, null, null, req);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's audit log
 * GET /api/users/:id/audit
 */
async function getAuditLog(req, res, next) {
  try {
    const userId = req.params.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    // Check user exists
    const user = await db.query("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get total count
    const countResult = await db.query("SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?", [userId]);
    const total = countResult[0].total;

    // Get audit logs
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Assign user to client
 * POST /api/users/:id/clients/:clientId
 */
async function assignToClient(req, res, next) {
  try {
    const userId = req.params.id;
    const clientId = req.params.clientId;

    // Check if requester is Super Admin or Admin
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin or Admin can assign users to clients",
      });
    }

    // Check user exists
    const user = await db.query("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check client exists
    const client = await db.query("SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL", [clientId]);
    if (client.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Client not found",
      });
    }

    // Check if already assigned
    const existing = await db.query(
      "SELECT id FROM user_clients WHERE user_id = ? AND client_id = ?",
      [userId, clientId]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: "User is already assigned to this client",
      });
    }

    // Create assignment
    await db.query(
      `INSERT INTO user_clients (user_id, client_id, assigned_at)
       VALUES (?, ?, NOW())`,
      [userId, clientId]
    );

    // Log audit
    await logAudit(req.user.id, "user_assigned_to_client", "user_clients", clientId, null, { user_id: userId }, req);

    res.status(201).json({
      success: true,
      message: "User assigned to client successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove user from client
 * DELETE /api/users/:id/clients/:clientId
 */
async function removeFromClient(req, res, next) {
  try {
    const userId = req.params.id;
    const clientId = req.params.clientId;

    // Check if requester is Super Admin or Admin
    if (!["super_admin", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin or Admin can remove user assignments",
      });
    }

    // Check assignment exists
    const assignment = await db.query(
      "SELECT id FROM user_clients WHERE user_id = ? AND client_id = ?",
      [userId, clientId]
    );
    if (assignment.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User is not assigned to this client",
      });
    }

    // Remove assignment
    await db.query("DELETE FROM user_clients WHERE user_id = ? AND client_id = ?", [userId, clientId]);

    // Log audit
    await logAudit(req.user.id, "user_removed_from_client", "user_clients", clientId, { user_id: userId }, null, req);

    res.json({
      success: true,
      message: "User removed from client successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user status (active/inactive/suspended)
 * PUT /api/users/:id/status
 */
async function updateStatus(req, res, next) {
  try {
    const userId = req.params.id;
    const { status } = req.body;

    // Check if requester is Super Admin
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Only Super Admin can update user status",
      });
    }

    if (!["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Must be active, inactive, or suspended",
      });
    }

    // Check user exists
    const user = await db.query("SELECT status FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const oldStatus = user[0].status;

    // Update status
    await db.query("UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?", [status, userId]);

    // Log audit
    await logAudit(req.user.id, "user_status_updated", "users", userId, { status: oldStatus }, { status }, req);

    const updatedUser = await getUserWithRoles(userId);

    res.json({
      success: true,
      message: "User status updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search and filter users
 * GET /api/users/search?q=&role=&status=&page=1&limit=10
 */
async function search(req, res, next) {
  try {
    const q = req.query.q || "";
    const role = req.query.role || "";
    const status = req.query.status || "";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE u.deleted_at IS NULL";
    const params = [];

    if (q) {
      whereClause += " AND (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)";
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status && ["active", "inactive", "suspended"].includes(status)) {
      whereClause += " AND u.status = ?";
      params.push(status);
    }

    if (role && ROLES.includes(role)) {
      whereClause += " AND ur.role = ?";
      params.push(role);
    }

    // Get total count
    let countQuery = `SELECT COUNT(DISTINCT u.id) as total FROM users u`;
    if (role) {
      countQuery += ` LEFT JOIN user_roles ur ON u.id = ur.user_id`;
    }
    countQuery += ` ${whereClause}`;

    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;

    // Get paginated results
    let query = `
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at
      FROM users u
    `;

    if (role) {
      query += ` LEFT JOIN user_roles ur ON u.id = ur.user_id`;
    }

    query += ` ${whereClause} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const users = await db.query(query, params);

    // Get roles for each user
    for (const user of users) {
      const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [user.id]);
      user.roles = roles.map((r) => r.role);
    }

    res.json({
      success: true,
      data: users,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to get user with roles
 */
async function getUserWithRoles(userId) {
  const users = await db.query(
    `SELECT id, email, first_name, last_name, phone, avatar_url, status, 
            last_login_at, created_at, updated_at
     FROM users WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );

  if (users.length === 0) {
    return null;
  }

  const user = users[0];
  const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
  user.roles = roles.map((r) => r.role);

  return user;
}

/**
 * Helper function to log audit
 */
async function logAudit(userId, action, resourceType, resourceId, oldValues, newValues, req) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || "";
    const userAgent = req.get("user-agent") || "";

    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success')`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    console.error("Error logging audit:", error);
  }
}

module.exports = {
  create,
  list,
  get,
  update,
  updateRoles,
  remove,
  getAuditLog,
  assignToClient,
  removeFromClient,
  updateStatus,
  search,
};
