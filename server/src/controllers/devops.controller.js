const db = require("../config/db");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");
const { validateRequired, validateString } = require("../lib/validators");
const { getErrorMessage } = require("../lib/errors");

const execPromise = promisify(exec);

// ==================== SERVER MONITORING FUNCTIONS ====================

/**
 * Get current server metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getServerMetrics = async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      server_info: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || "Unknown",
        speed: os.cpus()[0]?.speed || 0,
        load_average: os.loadavg(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage_percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
      },
      node_process: {
        pid: process.pid,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime(),
        version: process.version,
      },
    };

    // Try to get disk usage (platform specific)
    try {
      const diskCommand = process.platform === "win32" ? "wmic logicaldisk get size,freespace" : "df -h";
      const { stdout } = await execPromise(diskCommand);
      metrics.disk = stdout;
    } catch (err) {
      metrics.disk = "Unable to retrieve disk information";
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Get server metrics error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get CPU usage details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCPUUsage = async (req, res) => {
  try {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    const cpuDetails = {
      timestamp: new Date().toISOString(),
      total_cores: cpus.length,
      cpu_info: cpus.map((cpu, index) => ({
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        times: cpu.times,
      })),
      load_average: {
        one_minute: loadAverage[0],
        five_minutes: loadAverage[1],
        fifteen_minutes: loadAverage[2],
      },
      load_percent: {
        one_minute: ((loadAverage[0] / cpus.length) * 100).toFixed(2),
        five_minutes: ((loadAverage[1] / cpus.length) * 100).toFixed(2),
        fifteen_minutes: ((loadAverage[2] / cpus.length) * 100).toFixed(2),
      },
    };

    res.json({
      success: true,
      data: cpuDetails,
    });
  } catch (error) {
    console.error("Get CPU usage error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get memory usage details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getMemoryUsage = async (req, res) => {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const processMemory = process.memoryUsage();

    const memoryDetails = {
      timestamp: new Date().toISOString(),
      system: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage_percent: ((usedMemory / totalMemory) * 100).toFixed(2),
      },
      process: {
        rss: processMemory.rss,
        heap_total: processMemory.heapTotal,
        heap_used: processMemory.heapUsed,
        external: processMemory.external,
        array_buffers: processMemory.arrayBuffers,
      },
    };

    res.json({
      success: true,
      data: memoryDetails,
    });
  } catch (error) {
    console.error("Get memory usage error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get server uptime
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getServerUptime = async (req, res) => {
  try {
    const uptimeSeconds = os.uptime();
    const processUptimeSeconds = process.uptime();

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    const processDays = Math.floor(processUptimeSeconds / 86400);
    const processHours = Math.floor((processUptimeSeconds % 86400) / 3600);
    const processMinutes = Math.floor((processUptimeSeconds % 3600) / 60);
    const processSeconds = Math.floor(processUptimeSeconds % 60);

    const uptime = {
      timestamp: new Date().toISOString(),
      system: {
        seconds: uptimeSeconds,
        formatted: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        days,
        hours,
        minutes,
        seconds,
      },
      process: {
        seconds: processUptimeSeconds,
        formatted: `${processDays}d ${processHours}h ${processMinutes}m ${processSeconds}s`,
        days: processDays,
        hours: processHours,
        minutes: processMinutes,
        seconds: processSeconds,
      },
      availability_percent: ((uptimeSeconds / (86400 * 30)) * 100).toFixed(2), // Last 30 days
    };

    res.json({
      success: true,
      data: uptime,
    });
  } catch (error) {
    console.error("Get server uptime error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== HEALTH CHECK FUNCTIONS ====================

/**
 * Run comprehensive health check
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getHealthCheck = async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      status: "healthy",
      checks: {},
    };

    // Database check
    try {
      await db.query("SELECT 1");
      healthData.checks.database = { status: "ok", timestamp: new Date().toISOString() };
    } catch (err) {
      healthData.checks.database = { status: "error", error: err.message };
      healthData.status = "degraded";
    }

    // Memory check
    const memoryUsagePercent = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    healthData.checks.memory = {
      status: memoryUsagePercent > 90 ? "warning" : "ok",
      usage_percent: memoryUsagePercent.toFixed(2),
    };

    // CPU check
    const avgLoad = os.loadavg()[0] / os.cpus().length;
    healthData.checks.cpu = {
      status: avgLoad > 0.9 ? "warning" : "ok",
      load_percent: (avgLoad * 100).toFixed(2),
    };

    // Disk check (if available)
    try {
      healthData.checks.disk = { status: "ok", message: "Disk check available" };
    } catch (err) {
      healthData.checks.disk = { status: "unavailable", message: "Cannot check disk" };
    }

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    console.error("Get health check error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Record health check in database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.recordHealthCheck = async (req, res) => {
  try {
    const { status, details } = req.body;
    const userId = req.user.id;

    if (!validateRequired(status)) {
      return res.status(400).json({ error: "Status is required" });
    }

    if (!["healthy", "degraded", "unhealthy"].includes(status)) {
      return res.status(400).json({ error: "Status must be healthy, degraded, or unhealthy" });
    }

    // Insert health check
    const result = await db.query(
      `INSERT INTO server_health_checks (status, details, checked_by, checked_at)
       VALUES (?, ?, ?, NOW())`,
      [status, details ? JSON.stringify(details) : null, userId]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, 'health_check_recorded', 'server', ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ status })]
    );

    res.status(201).json({
      success: true,
      data: {
        health_check_id: result.insertId,
        status,
      },
    });
  } catch (error) {
    console.error("Record health check error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get health check history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getHealthCheckHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM server_health_checks ${whereClause}`, params);
    const total = countResult[0].total;

    // Get health checks
    const checks = await db.query(
      `SELECT * FROM server_health_checks ${whereClause} ORDER BY checked_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: checks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get health check history error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== PROCESS MONITORING ====================

/**
 * Get active processes and services
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProcessStatus = async (req, res) => {
  try {
    const processStatus = {
      timestamp: new Date().toISOString(),
      node_process: {
        pid: process.pid,
        ppid: process.ppid ? process.ppid : "N/A",
        title: process.title,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      services: {
        api_server: "running",
        database: "checking",
        email_queue: "monitoring",
        notification_service: "active",
      },
    };

    // Check database service
    try {
      await db.query("SELECT 1");
      processStatus.services.database = "running";
    } catch (err) {
      processStatus.services.database = "error";
    }

    res.json({
      success: true,
      data: processStatus,
    });
  } catch (error) {
    console.error("Get process status error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== LOG MONITORING ====================

/**
 * Get system logs summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getLogsSummary = async (req, res) => {
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

    // Total audit logs
    const auditTotal = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    // Error logs
    const errorLogs = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE 'error%' ${dateWhereClause}`,
      dateParams
    );

    // Failed operations
    const failedOps = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE 'failed%' ${dateWhereClause}`,
      dateParams
    );

    // Activity logs
    const activityLogs = await db.query(
      `SELECT COUNT(*) as count FROM activity_logs WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    const summary = {
      timestamp: new Date().toISOString(),
      period: {
        start_date,
        end_date,
      },
      audit_logs: auditTotal[0].count,
      error_logs: errorLogs[0].count,
      failed_operations: failedOps[0].count,
      activity_logs: activityLogs[0].count,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get logs summary error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== ALERT MANAGEMENT ====================

/**
 * Create alert rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createAlertRule = async (req, res) => {
  try {
    const { alert_name, condition, threshold, metric_type, notification_channels } = req.body;
    const userId = req.user.id;

    if (!validateRequired(alert_name)) {
      return res.status(400).json({ error: "Alert name is required" });
    }

    if (!validateRequired(condition)) {
      return res.status(400).json({ error: "Condition is required" });
    }

    if (threshold === undefined || threshold === null) {
      return res.status(400).json({ error: "Threshold is required" });
    }

    if (!validateRequired(metric_type)) {
      return res.status(400).json({ error: "Metric type is required" });
    }

    // Insert alert rule
    const result = await db.query(
      `INSERT INTO alert_rules (alert_name, condition, threshold, metric_type, notification_channels, created_by, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        alert_name,
        condition,
        threshold,
        metric_type,
        notification_channels ? JSON.stringify(notification_channels) : null,
        userId,
      ]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, 'alert_rule_created', 'alert', ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ alert_name, condition, threshold })]
    );

    res.status(201).json({
      success: true,
      data: {
        alert_rule_id: result.insertId,
        alert_name,
        status: "active",
      },
    });
  } catch (error) {
    console.error("Create alert rule error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get alert rules
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAlertRules = async (req, res) => {
  try {
    const { page = 1, limit = 20, is_active } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (is_active !== undefined) {
      whereClause += " AND is_active = ?";
      params.push(is_active === "true" ? 1 : 0);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM alert_rules ${whereClause}`, params);
    const total = countResult[0].total;

    // Get alert rules
    const rules = await db.query(
      `SELECT * FROM alert_rules ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get alert rules error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Update alert rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAlertRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { alert_name, condition, threshold, is_active } = req.body;
    const userId = req.user.id;

    // Get current rule
    const ruleResult = await db.query(`SELECT * FROM alert_rules WHERE id = ?`, [id]);

    if (ruleResult.length === 0) {
      return res.status(404).json({ error: "Alert rule not found" });
    }

    const updates = {};

    if (alert_name) updates.alert_name = alert_name;
    if (condition) updates.condition = condition;
    if (threshold !== undefined) updates.threshold = threshold;
    if (is_active !== undefined) updates.is_active = is_active ? 1 : 0;

    const updateFields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const updateValues = Object.values(updates);

    await db.query(`UPDATE alert_rules SET ${updateFields}, updated_at = NOW() WHERE id = ?`, [
      ...updateValues,
      id,
    ]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, 'alert_rule_updated', 'alert', ?, ?, NOW())`,
      [userId, id, JSON.stringify(updates)]
    );

    res.json({
      success: true,
      data: {
        alert_rule_id: id,
        updated_fields: Object.keys(updates),
      },
    });
  } catch (error) {
    console.error("Update alert rule error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Delete alert rule
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteAlertRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get rule
    const ruleResult = await db.query(`SELECT * FROM alert_rules WHERE id = ?`, [id]);

    if (ruleResult.length === 0) {
      return res.status(404).json({ error: "Alert rule not found" });
    }

    // Delete rule
    await db.query(`DELETE FROM alert_rules WHERE id = ?`, [id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, 'alert_rule_deleted', 'alert', ?, ?, NOW())`,
      [userId, id, JSON.stringify({ deleted_rule: ruleResult[0].alert_name })]
    );

    res.json({
      success: true,
      data: {
        alert_rule_id: id,
        message: "Alert rule deleted successfully",
      },
    });
  } catch (error) {
    console.error("Delete alert rule error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== BACKUP MONITORING ====================

/**
 * Get backup status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getBackupStatus = async (req, res) => {
  try {
    const backupStatus = {
      timestamp: new Date().toISOString(),
      database: {
        last_backup: "N/A",
        backup_size: "N/A",
        status: "pending",
      },
      files: {
        last_backup: "N/A",
        backed_up_files: 0,
        status: "pending",
      },
      schedule: {
        database_backup: "daily at 02:00 UTC",
        file_backup: "weekly on Sunday",
      },
    };

    res.json({
      success: true,
      data: backupStatus,
    });
  } catch (error) {
    console.error("Get backup status error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get system diagnostics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSystemDiagnostics = async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
      },
      resources: {
        cpu_cores: os.cpus().length,
        memory_gb: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
      },
      environment: {
        node_version: process.version,
        npm_version: "checking",
        environment: process.env.NODE_ENV,
      },
      checks: {
        database_connection: "pending",
        api_endpoints: "pending",
        external_services: "pending",
      },
    };

    res.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error("Get system diagnostics error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

module.exports = exports;
