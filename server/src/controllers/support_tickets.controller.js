/**
 * Support Ticket System Controller
 * Handles ticket creation, management, assignment, comments, and SLA tracking
 */

const db = require("../config/db");
const crypto = require("crypto");

/**
 * Create a new support ticket
 * POST /api/tickets
 */
exports.createTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, description, category, priority = "medium", attachments } = req.body;

    // Validation
    if (!subject || !description || !category) {
      return res.status(400).json({ error: "Validation failed: subject, description, and category required" });
    }

    if (subject.length < 5 || subject.length > 200) {
      return res.status(400).json({ error: "Subject must be between 5-200 characters" });
    }

    if (description.length < 10 || description.length > 10000) {
      return res.status(400).json({ error: "Description must be between 10-10000 characters" });
    }

    const validPriorities = ["low", "medium", "high", "critical"];
    const validCategories = ["billing", "technical", "account", "general", "feature-request", "bug-report"];

    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority level" });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Calculate SLA times based on priority
    const slaTimes = {
      critical: 1,    // 1 hour response
      high: 4,        // 4 hours response
      medium: 8,      // 8 hours response
      low: 24         // 24 hours response
    };

    const responseDeadline = new Date(Date.now() + slaTimes[priority] * 60 * 60 * 1000);

    // Create ticket
    const result = await db.query(
      `INSERT INTO support_tickets (ticket_number, user_id, subject, description, category, priority, status, response_deadline, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [ticketNumber, userId, subject, description, category, priority, "open", responseDeadline]
    );

    // Add initial comment
    await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
       VALUES (?, ?, ?, ?)`,
      [result.insertId, userId, description, false]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "ticket_created", "support_ticket", result.insertId, req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        ticket_id: result.insertId,
        ticket_number: ticketNumber,
        subject,
        category,
        priority,
        status: "open",
        created_at: new Date().toISOString(),
        response_deadline: responseDeadline.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * List support tickets with filtering
 * GET /api/tickets
 */
exports.listTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, category, assigned_to, search, page = 1, limit = 20 } = req.query;

    let query = `SELECT * FROM support_tickets WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (assigned_to) {
      query += ` AND assigned_to = ?`;
      params.push(assigned_to);
    }

    if (search) {
      query += ` AND (subject LIKE ? OR description LIKE ? OR ticket_number LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY created_at DESC`;

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM support_tickets WHERE user_id = ?`, [userId]);
    const total = countResult[0].total;

    // Paginate
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const tickets = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List tickets error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get single ticket details
 * GET /api/tickets/:id
 */
exports.getTicketDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Fetch ticket
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ? AND (user_id = ? OR assigned_to = ?)`,
      [id, userId, userId]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult[0];

    // Fetch comments
    const comments = await db.query(
      `SELECT tc.*, u.email, u.name FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at ASC`,
      [id]
    );

    // Fetch activity history
    const history = await db.query(
      `SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at DESC`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...ticket,
        comments,
        history,
      },
    });
  } catch (error) {
    console.error("Get ticket details error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update ticket status
 * PATCH /api/tickets/:id/status
 */
exports.updateTicketStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validation
    if (!status) {
      return res.status(400).json({ error: "Status required" });
    }

    const validStatuses = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Check ticket exists and user has access
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ? AND (user_id = ? OR assigned_to = ?)`,
      [id, userId, userId]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const oldStatus = ticketResult[0].status;

    // Update status
    let updateData = { status, updated_at: new Date() };
    if (status === "resolved") {
      updateData.resolved_at = new Date();
    }

    await db.query(
      `UPDATE support_tickets SET status = ?, resolved_at = ? WHERE id = ?`,
      [status, status === "resolved" ? new Date() : null, id]
    );

    // Add status change to history
    await db.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, "status", oldStatus, status]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "ticket_status_updated", "support_ticket", id, JSON.stringify({ old: oldStatus, new: status }), req.ip]
    );

    res.status(200).json({
      success: true,
      data: {
        ticket_id: id,
        old_status: oldStatus,
        new_status: status,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update ticket status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Assign ticket to agent
 * PATCH /api/tickets/:id/assign
 */
exports.assignTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { assigned_to } = req.body;

    if (!assigned_to) {
      return res.status(400).json({ error: "assigned_to user_id required" });
    }

    // Verify assigned user exists and has agent role
    const agentResult = await db.query(
      `SELECT ur.* FROM user_roles ur WHERE ur.user_id = ? AND ur.role IN ('support_agent', 'super_admin')`,
      [assigned_to]
    );

    if (agentResult.length === 0) {
      return res.status(400).json({ error: "User is not a support agent" });
    }

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ?`,
      [id]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const oldAssignee = ticketResult[0].assigned_to;

    // Update assignment
    await db.query(
      `UPDATE support_tickets SET assigned_to = ?, updated_at = NOW() WHERE id = ?`,
      [assigned_to, id]
    );

    // Add to history
    await db.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, "assigned_to", oldAssignee || "unassigned", assigned_to]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "ticket_assigned", "support_ticket", id, JSON.stringify({ assigned_to }), req.ip]
    );

    res.status(200).json({
      success: true,
      data: {
        ticket_id: id,
        assigned_to,
        previous_assignee: oldAssignee,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Assign ticket error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Add comment to ticket
 * POST /api/tickets/:id/comments
 */
exports.addTicketComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { comment_text, is_internal = false } = req.body;

    // Validation
    if (!comment_text || comment_text.length < 1 || comment_text.length > 5000) {
      return res.status(400).json({ error: "Comment must be between 1-5000 characters" });
    }

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ? AND (user_id = ? OR assigned_to = ?)`,
      [id, userId, userId]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Add comment
    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, is_internal)
       VALUES (?, ?, ?, ?)`,
      [id, userId, comment_text, is_internal]
    );

    // Update ticket updated_at
    await db.query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = ?`, [id]);

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "ticket_comment_added", "support_ticket", id, req.ip]
    );

    res.status(201).json({
      success: true,
      data: {
        comment_id: result.insertId,
        ticket_id: id,
        comment_text,
        is_internal,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get ticket comments
 * GET /api/tickets/:id/comments
 */
exports.getTicketComments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ? AND (user_id = ? OR assigned_to = ?)`,
      [id, userId, userId]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Fetch comments
    let query = `SELECT tc.*, u.email, u.name FROM ticket_comments tc
                 LEFT JOIN users u ON tc.user_id = u.id
                 WHERE tc.ticket_id = ?`;

    // Hide internal comments from non-agents
    const userResult = await db.query(
      `SELECT role FROM user_roles WHERE user_id = ?`,
      [userId]
    );

    const isAgent = userResult.some(r => r.role === "support_agent" || r.role === "super_admin");
    if (!isAgent) {
      query += ` AND tc.is_internal = 0`;
    }

    query += ` ORDER BY tc.created_at DESC LIMIT ? OFFSET ?`;

    const offset = (page - 1) * limit;
    const comments = await db.query(query, [id, limit, offset]);

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get ticket statistics/metrics
 * GET /api/tickets/stats/overview
 */
exports.getTicketStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = "";
    const params = [];

    if (start_date && end_date) {
      dateFilter = ` WHERE DATE(created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    // Overall stats
    const overallStats = await db.query(
      `SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_resolution_time
      FROM support_tickets ${dateFilter}`,
      params
    );

    // Stats by priority
    const byPriority = await db.query(
      `SELECT priority, COUNT(*) as count, 
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
       FROM support_tickets ${dateFilter}
       GROUP BY priority`,
      params
    );

    // Stats by category
    const byCategory = await db.query(
      `SELECT category, COUNT(*) as count, 
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
       FROM support_tickets ${dateFilter}
       GROUP BY category`,
      params
    );

    // SLA compliance
    const slaStats = await db.query(
      `SELECT 
        SUM(CASE WHEN response_deadline < NOW() AND status != 'resolved' THEN 1 ELSE 0 END) as sla_breached,
        SUM(CASE WHEN response_deadline >= NOW() OR status = 'resolved' THEN 1 ELSE 0 END) as sla_met
       FROM support_tickets ${dateFilter}`,
      params
    );

    res.status(200).json({
      success: true,
      data: {
        overall: overallStats[0] || {},
        by_priority: byPriority,
        by_category: byCategory,
        sla_compliance: slaStats[0] || {},
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update ticket priority
 * PATCH /api/tickets/:id/priority
 */
exports.updateTicketPriority = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({ error: "Priority required" });
    }

    const validPriorities = ["low", "medium", "high", "critical"];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ?`,
      [id]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const oldPriority = ticketResult[0].priority;

    // Update priority
    await db.query(
      `UPDATE support_tickets SET priority = ?, updated_at = NOW() WHERE id = ?`,
      [priority, id]
    );

    // Add to history
    await db.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, "priority", oldPriority, priority]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, "ticket_priority_updated", "support_ticket", id, JSON.stringify({ old: oldPriority, new: priority }), req.ip]
    );

    res.status(200).json({
      success: true,
      data: {
        ticket_id: id,
        old_priority: oldPriority,
        new_priority: priority,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Update priority error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Close ticket
 * POST /api/tickets/:id/close
 */
exports.closeTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { resolution_summary, satisfaction_rating } = req.body;

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT * FROM support_tickets WHERE id = ?`,
      [id]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Validate satisfaction rating if provided
    if (satisfaction_rating && (satisfaction_rating < 1 || satisfaction_rating > 5)) {
      return res.status(400).json({ error: "Satisfaction rating must be between 1-5" });
    }

    // Close ticket
    await db.query(
      `UPDATE support_tickets 
       SET status = 'closed', closed_at = NOW(), satisfaction_rating = ?, resolution_summary = ?
       WHERE id = ?`,
      [satisfaction_rating || null, resolution_summary || null, id]
    );

    // Add to history
    await db.query(
      `INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, "status", ticketResult[0].status, "closed"]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "ticket_closed", "support_ticket", id, req.ip]
    );

    res.status(200).json({
      success: true,
      data: {
        ticket_id: id,
        status: "closed",
        satisfaction_rating: satisfaction_rating || null,
        closed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Close ticket error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get ticket history
 * GET /api/tickets/:id/history
 */
exports.getTicketHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check ticket exists
    const ticketResult = await db.query(
      `SELECT id FROM support_tickets WHERE id = ?`,
      [id]
    );

    if (ticketResult.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Fetch history
    const offset = (page - 1) * limit;
    const history = await db.query(
      `SELECT th.*, u.email, u.name FROM ticket_history th
       LEFT JOIN users u ON th.changed_by = u.id
       WHERE th.ticket_id = ?
       ORDER BY th.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    res.status(200).json({
      success: true,
      data: history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Search tickets
 * GET /api/tickets/search
 */
exports.searchTickets = async (req, res) => {
  try {
    const { query, filters } = req.body;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    let sql = `SELECT * FROM support_tickets WHERE (subject LIKE ? OR description LIKE ? OR ticket_number LIKE ?)`;
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (filters) {
      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.priority) {
        sql += ` AND priority = ?`;
        params.push(filters.priority);
      }
      if (filters.category) {
        sql += ` AND category = ?`;
        params.push(filters.category);
      }
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const results = await db.query(sql, params);

    res.status(200).json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error("Search tickets error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
