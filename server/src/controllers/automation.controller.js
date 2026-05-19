const db = require("../config/db");
const { validateRequired, validateString, validateEmail } = require("../lib/validators");
const { getErrorMessage } = require("../lib/errors");
const CronParser = require("cron-parser");

// ==================== JOB CREATION ====================

/**
 * Create a new automated job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createJob = async (req, res) => {
  try {
    const { job_name, job_type, cron_expression, timezone, job_config, description, is_active } = req.body;
    const userId = req.user.id;

    // Validation
    if (!validateRequired(job_name)) {
      return res.status(400).json({ error: "Job name is required" });
    }
    if (!validateString(job_name, 3, 100)) {
      return res.status(400).json({ error: "Job name must be 3-100 characters" });
    }

    const validJobTypes = ["send_email", "generate_invoice", "send_sms", "send_whatsapp", "backup", "report", "notification", "cleanup"];
    if (!validJobTypes.includes(job_type)) {
      return res.status(400).json({ error: `Invalid job type. Valid types: ${validJobTypes.join(", ")}` });
    }

    if (!validateRequired(cron_expression)) {
      return res.status(400).json({ error: "Cron expression is required" });
    }

    // Validate cron expression
    try {
      CronParser.parseExpression(cron_expression);
    } catch (err) {
      return res.status(400).json({ error: "Invalid cron expression format" });
    }

    if (!timezone) {
      return res.status(400).json({ error: "Timezone is required" });
    }

    // Check permissions
    const permResult = await db.query(
      `SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ? AND permission_name = 'manage_automation'`,
      [userId]
    );
    if (permResult[0].count === 0) {
      const roleResult = await db.query(`SELECT role FROM user_roles WHERE user_id = ?`, [userId]);
      const isSuperAdmin = roleResult.some(r => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "You don't have permission to manage automation" });
      }
    }

    // Calculate next execution time
    let nextExecutionTime;
    try {
      const interval = CronParser.parseExpression(cron_expression);
      nextExecutionTime = interval.next().toDate();
    } catch (err) {
      return res.status(400).json({ error: "Could not calculate next execution time" });
    }

    // Insert job
    const result = await db.query(
      `INSERT INTO automated_jobs (job_name, job_type, cron_expression, timezone, job_config, description, is_active, next_execution_time, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        job_name,
        job_type,
        cron_expression,
        timezone,
        JSON.stringify(job_config || {}),
        description || null,
        is_active !== false ? 1 : 0,
        nextExecutionTime,
        userId,
      ]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'job_created', 'automated_job', ?, ?, ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ job_name, job_type }), req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        job_id: result.insertId,
        job_name,
        job_type,
        status: "created",
        next_execution_time: nextExecutionTime,
      },
    });
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB LISTING ====================

/**
 * List all automated jobs with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.listJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { job_type, is_active, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Base query
    let whereClause = "WHERE 1=1";
    const params = [];

    if (job_type) {
      whereClause += " AND job_type = ?";
      params.push(job_type);
    }

    if (is_active !== undefined) {
      whereClause += " AND is_active = ?";
      params.push(is_active === "true" ? 1 : 0);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM automated_jobs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get jobs
    const jobs = await db.query(
      `SELECT * FROM automated_jobs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse job configs
    const jobsWithParsedConfig = jobs.map(job => ({
      ...job,
      job_config: JSON.parse(job.job_config || "{}"),
    }));

    res.json({
      success: true,
      data: jobsWithParsedConfig,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List jobs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB DETAILS ====================

/**
 * Get details of a specific job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getJobDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);

    if (job.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const jobData = job[0];
    jobData.job_config = JSON.parse(jobData.job_config || "{}");

    // Get recent execution history
    const history = await db.query(
      `SELECT * FROM job_executions WHERE job_id = ? ORDER BY executed_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        job: jobData,
        recent_executions: history,
      },
    });
  } catch (error) {
    console.error("Get job details error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB UPDATE ====================

/**
 * Update job configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { job_name, cron_expression, timezone, job_config, description, is_active } = req.body;
    const userId = req.user.id;

    // Check permissions
    const permResult = await db.query(
      `SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ? AND permission_name = 'manage_automation'`,
      [userId]
    );
    if (permResult[0].count === 0) {
      const roleResult = await db.query(`SELECT role FROM user_roles WHERE user_id = ?`, [userId]);
      const isSuperAdmin = roleResult.some(r => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "You don't have permission to update jobs" });
      }
    }

    // Get current job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const currentJob = jobResult[0];
    const updates = {};

    if (job_name) {
      if (!validateString(job_name, 3, 100)) {
        return res.status(400).json({ error: "Job name must be 3-100 characters" });
      }
      updates.job_name = job_name;
    }

    if (cron_expression) {
      try {
        CronParser.parseExpression(cron_expression);
        updates.cron_expression = cron_expression;
      } catch (err) {
        return res.status(400).json({ error: "Invalid cron expression format" });
      }
    }

    if (timezone) {
      updates.timezone = timezone;
    }

    if (job_config) {
      updates.job_config = JSON.stringify(job_config);
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active ? 1 : 0;
    }

    // Calculate new next execution time if cron changed
    if (cron_expression) {
      try {
        const interval = CronParser.parseExpression(cron_expression);
        updates.next_execution_time = interval.next().toDate();
      } catch (err) {
        return res.status(400).json({ error: "Could not calculate next execution time" });
      }
    }

    // Build update query
    const updateFields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const updateValues = Object.values(updates);

    await db.query(`UPDATE automated_jobs SET ${updateFields}, updated_at = NOW() WHERE id = ?`, [...updateValues, id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'job_updated', 'automated_job', ?, ?, ?, ?, NOW())`,
      [userId, id, JSON.stringify(updates), req.ip, req.get("user-agent")]
    );

    res.json({
      success: true,
      data: {
        job_id: id,
        updated_fields: Object.keys(updates),
        next_execution_time: updates.next_execution_time || currentJob.next_execution_time,
      },
    });
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB DELETION ====================

/**
 * Delete an automated job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check permissions
    const permResult = await db.query(
      `SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ? AND permission_name = 'manage_automation'`,
      [userId]
    );
    if (permResult[0].count === 0) {
      const roleResult = await db.query(`SELECT role FROM user_roles WHERE user_id = ?`, [userId]);
      const isSuperAdmin = roleResult.some(r => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "You don't have permission to delete jobs" });
      }
    }

    // Get job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Delete related executions
    await db.query(`DELETE FROM job_executions WHERE job_id = ?`, [id]);

    // Delete job
    await db.query(`DELETE FROM automated_jobs WHERE id = ?`, [id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'job_deleted', 'automated_job', ?, ?, ?, ?, NOW())`,
      [userId, id, JSON.stringify({ deleted_job: jobResult[0].job_name }), req.ip, req.get("user-agent")]
    );

    res.json({
      success: true,
      data: {
        job_id: id,
        message: "Job deleted successfully",
      },
    });
  } catch (error) {
    console.error("Delete job error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB TOGGLE ====================

/**
 * Enable or disable a job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.toggleJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = req.user.id;

    if (typeof is_active !== "boolean") {
      return res.status(400).json({ error: "is_active must be a boolean" });
    }

    // Check permissions
    const permResult = await db.query(
      `SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ? AND permission_name = 'manage_automation'`,
      [userId]
    );
    if (permResult[0].count === 0) {
      const roleResult = await db.query(`SELECT role FROM user_roles WHERE user_id = ?`, [userId]);
      const isSuperAdmin = roleResult.some(r => r.role === "super_admin");
      if (!isSuperAdmin) {
        return res.status(403).json({ error: "You don't have permission to toggle jobs" });
      }
    }

    // Get job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const oldStatus = jobResult[0].is_active;

    // Update job
    await db.query(`UPDATE automated_jobs SET is_active = ?, updated_at = NOW() WHERE id = ?`, [is_active ? 1 : 0, id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'job_toggled', 'automated_job', ?, ?, ?, ?, NOW())`,
      [userId, id, JSON.stringify({ old_status: oldStatus, new_status: is_active }), req.ip, req.get("user-agent")]
    );

    res.json({
      success: true,
      data: {
        job_id: id,
        is_active,
        status: is_active ? "enabled" : "disabled",
      },
    });
  } catch (error) {
    console.error("Toggle job error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB EXECUTION ====================

/**
 * Manually execute a job
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.executeJob = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const job = jobResult[0];
    const executionStartTime = new Date();
    let executionStatus = "completed";
    let executionError = null;

    // Simulate job execution (in production, this would be actual job execution)
    try {
      // Execute based on job type
      switch (job.job_type) {
        case "send_email":
          // Email sending logic
          break;
        case "generate_invoice":
          // Invoice generation logic
          break;
        case "send_sms":
          // SMS sending logic
          break;
        case "send_whatsapp":
          // WhatsApp sending logic
          break;
        case "backup":
          // Backup logic
          break;
        case "report":
          // Report generation logic
          break;
        case "notification":
          // Notification logic
          break;
        case "cleanup":
          // Cleanup logic
          break;
      }
    } catch (err) {
      executionStatus = "failed";
      executionError = err.message;
    }

    const executionEndTime = new Date();
    const executionDuration = (executionEndTime - executionStartTime) / 1000; // in seconds

    // Record execution
    const execResult = await db.query(
      `INSERT INTO job_executions (job_id, execution_status, execution_duration, execution_error, executed_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, executionStatus, executionDuration, executionError, executionStartTime, executionEndTime]
    );

    // Update job last execution
    await db.query(`UPDATE automated_jobs SET last_executed_at = ?, updated_at = NOW() WHERE id = ?`, [executionStartTime, id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'job_executed', 'automated_job', ?, ?, ?, ?, NOW())`,
      [
        userId,
        id,
        JSON.stringify({ status: executionStatus, duration: executionDuration }),
        req.ip,
        req.get("user-agent"),
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        execution_id: execResult.insertId,
        job_id: id,
        status: executionStatus,
        duration_seconds: executionDuration,
        error: executionError,
        executed_at: executionStartTime,
        completed_at: executionEndTime,
      },
    });
  } catch (error) {
    console.error("Execute job error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB HISTORY ====================

/**
 * Get job execution history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getJobHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    // Get job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Build query
    let whereClause = "WHERE job_id = ?";
    const params = [id];

    if (status) {
      whereClause += " AND execution_status = ?";
      params.push(status);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM job_executions ${whereClause}`, params);
    const total = countResult[0].total;

    // Get executions
    const executions = await db.query(
      `SELECT * FROM job_executions ${whereClause} ORDER BY executed_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: executions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get job history error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== JOB LOGS ====================

/**
 * Get job execution logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getJobLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    // Get job
    const jobResult = await db.query(`SELECT * FROM automated_jobs WHERE id = ?`, [id]);
    if (jobResult.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Build query
    let whereClause = "WHERE job_id = ?";
    const params = [id];

    if (status) {
      whereClause += " AND log_level = ?";
      params.push(status);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM job_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get logs
    const logs = await db.query(
      `SELECT * FROM job_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
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
    console.error("Get job logs error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== STATISTICS ====================

/**
 * Get automation statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAutomationStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Overall stats
    const overallStats = await db.query(`
      SELECT 
        COUNT(*) as total_jobs,
        SUM(is_active) as active_jobs,
        COUNT(DISTINCT job_type) as job_types
      FROM automated_jobs
    `);

    // Execution stats
    let executionWhereClause = "WHERE 1=1";
    const execParams = [];

    if (start_date) {
      executionWhereClause += " AND executed_at >= ?";
      execParams.push(start_date);
    }

    if (end_date) {
      executionWhereClause += " AND executed_at <= ?";
      execParams.push(end_date);
    }

    const executionStats = await db.query(
      `
      SELECT 
        execution_status,
        COUNT(*) as count,
        AVG(execution_duration) as avg_duration
      FROM job_executions
      ${executionWhereClause}
      GROUP BY execution_status
    `,
      execParams
    );

    // Job type stats
    const jobTypeStats = await db.query(`
      SELECT 
        job_type,
        COUNT(*) as job_count,
        SUM(is_active) as active_count
      FROM automated_jobs
      GROUP BY job_type
    `);

    // Failed jobs
    const failedStats = await db.query(
      `
      SELECT 
        COUNT(*) as failed_count,
        AVG(execution_duration) as avg_failed_duration
      FROM job_executions
      WHERE execution_status = 'failed'
      ${executionWhereClause}
    `,
      execParams
    );

    res.json({
      success: true,
      data: {
        overall: overallStats[0],
        by_status: executionStats,
        by_job_type: jobTypeStats,
        failed_jobs: failedStats[0],
      },
    });
  } catch (error) {
    console.error("Get automation stats error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

module.exports = exports;
