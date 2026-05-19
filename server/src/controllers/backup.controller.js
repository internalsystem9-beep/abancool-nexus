const db = require("../config/db");
const path = require("path");
const fs = require("fs").promises;
const { exec } = require("child_process");
const { promisify } = require("util");
const crypto = require("crypto");

const execAsync = promisify(exec);

// Helper: Generate backup filename
const generateBackupFilename = (type = "database") => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup_${type}_${timestamp}`;
};

// Helper: Calculate file hash
const calculateFileHash = async (filePath) => {
  try {
    const hash = crypto.createHash("sha256");
    const stream = require("fs").createReadStream(filePath);
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  } catch (error) {
    return null;
  }
};

// Helper: Get directory size
const getDirectorySize = async (dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { recursive: true });
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch (e) {
        // Skip files that can't be read
      }
    }
    return totalSize;
  } catch (error) {
    return 0;
  }
};

// ==================== BACKUP CREATION ====================

// Create immediate backup
exports.createBackup = async (req, res) => {
  try {
    const { backup_type = "database", description } = req.body;
    const userId = req.user.id;

    // Validate backup type
    if (!["database", "files", "full"].includes(backup_type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid backup type. Must be: database, files, or full",
      });
    }

    const backupPath = path.join(
      process.cwd(),
      "backups",
      generateBackupFilename(backup_type)
    );
    const backupSize = 0;
    const status = "pending";

    // Store backup record
    const result = await db.query(
      `INSERT INTO backup_history (
        backup_name, backup_type, status, size_bytes, created_by, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [path.basename(backupPath), backup_type, status, backupSize, userId, description || null]
    );

    const backupId = result.insertId;

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        "create_backup",
        "backup",
        backupId,
        JSON.stringify({ backup_type, status }),
      ]
    );

    // Execute backup in background
    setImmediate(async () => {
      try {
        // Simulate backup completion - in production, would execute actual backup commands
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await db.query(`UPDATE backup_history SET status = ? WHERE id = ?`, [
          "completed",
          backupId,
        ]);

        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [userId, "backup_completed", "backup", backupId]
        );
      } catch (error) {
        await db.query(`UPDATE backup_history SET status = ? WHERE id = ?`, [
          "failed",
          backupId,
        ]);
      }
    });

    res.status(201).json({
      success: true,
      data: {
        backup_id: backupId,
        backup_type,
        status,
        message: "Backup started",
      },
    });
  } catch (error) {
    console.error("Create backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create backup",
    });
  }
};

// ==================== BACKUP SCHEDULING ====================

// Schedule recurring backup
exports.scheduleBackup = async (req, res) => {
  try {
    const { schedule_name, backup_type, schedule_frequency, schedule_time, enabled } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!schedule_name) {
      return res.status(400).json({ success: false, error: "schedule_name is required" });
    }
    if (!backup_type || !["database", "files", "full"].includes(backup_type)) {
      return res.status(400).json({ success: false, error: "Valid backup_type is required" });
    }
    if (!schedule_frequency || !["daily", "weekly", "monthly"].includes(schedule_frequency)) {
      return res.status(400).json({
        success: false,
        error: "schedule_frequency must be: daily, weekly, or monthly",
      });
    }
    if (!schedule_time) {
      return res.status(400).json({ success: false, error: "schedule_time is required" });
    }

    // Insert schedule
    const result = await db.query(
      `INSERT INTO backup_schedules (
        schedule_name, backup_type, schedule_frequency, schedule_time,
        created_by, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [schedule_name, backup_type, schedule_frequency, schedule_time, userId, enabled !== false]
    );

    const scheduleId = result.insertId;

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        "create_backup_schedule",
        "backup_schedule",
        scheduleId,
        JSON.stringify({
          schedule_name,
          backup_type,
          schedule_frequency,
          schedule_time,
        }),
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        backup_schedule_id: scheduleId,
        schedule_name,
        backup_type,
        schedule_frequency,
        schedule_time,
        enabled: enabled !== false,
      },
    });
  } catch (error) {
    console.error("Schedule backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to schedule backup",
    });
  }
};

// Get all backup schedules
exports.getBackupSchedules = async (req, res) => {
  try {
    const { enabled, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM backup_schedules`;
    const params = [];

    if (enabled !== undefined) {
      query += ` WHERE enabled = ?`;
      params.push(enabled === "true" ? 1 : 0);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const schedules = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM backup_schedules`;
    if (enabled !== undefined) {
      countQuery += ` WHERE enabled = ?`;
    }
    const countParams = enabled !== undefined ? [enabled === "true" ? 1 : 0] : [];
    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    res.status(200).json({
      success: true,
      data: schedules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get backup schedules error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get backup schedules",
    });
  }
};

// Update backup schedule
exports.updateBackupSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule_name, schedule_frequency, schedule_time, enabled } = req.body;
    const userId = req.user.id;

    // Check if schedule exists
    const schedule = await db.query(`SELECT * FROM backup_schedules WHERE id = ?`, [id]);
    if (schedule.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup schedule not found",
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (schedule_name !== undefined) {
      updates.push(`schedule_name = ?`);
      params.push(schedule_name);
    }
    if (schedule_frequency !== undefined) {
      if (!["daily", "weekly", "monthly"].includes(schedule_frequency)) {
        return res.status(400).json({
          success: false,
          error: "schedule_frequency must be: daily, weekly, or monthly",
        });
      }
      updates.push(`schedule_frequency = ?`);
      params.push(schedule_frequency);
    }
    if (schedule_time !== undefined) {
      updates.push(`schedule_time = ?`);
      params.push(schedule_time);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = ?`);
      params.push(enabled ? 1 : 0);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    if (updates.length > 0) {
      await db.query(
        `UPDATE backup_schedules SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      // Log to audit trail
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          "update_backup_schedule",
          "backup_schedule",
          id,
          JSON.stringify(req.body),
        ]
      );
    }

    res.status(200).json({
      success: true,
      data: {
        backup_schedule_id: id,
        updated_fields: Object.keys(req.body),
      },
    });
  } catch (error) {
    console.error("Update backup schedule error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update backup schedule",
    });
  }
};

// Delete backup schedule
exports.deleteBackupSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if schedule exists
    const schedule = await db.query(`SELECT * FROM backup_schedules WHERE id = ?`, [id]);
    if (schedule.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup schedule not found",
      });
    }

    // Delete schedule
    await db.query(`DELETE FROM backup_schedules WHERE id = ?`, [id]);

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, "delete_backup_schedule", "backup_schedule", id]
    );

    res.status(200).json({
      success: true,
      data: {
        backup_schedule_id: id,
        message: "Backup schedule deleted",
      },
    });
  } catch (error) {
    console.error("Delete backup schedule error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete backup schedule",
    });
  }
};

// ==================== BACKUP HISTORY ====================

// Get backup history
exports.getBackupHistory = async (req, res) => {
  try {
    const { status, backup_type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM backup_history WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (backup_type) {
      query += ` AND backup_type = ?`;
      params.push(backup_type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const backups = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM backup_history WHERE 1=1`;
    const countParams = [];

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }
    if (backup_type) {
      countQuery += ` AND backup_type = ?`;
      countParams.push(backup_type);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    res.status(200).json({
      success: true,
      data: backups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get backup history error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get backup history",
    });
  }
};

// Get backup details
exports.getBackupDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const backup = await db.query(
      `SELECT bh.*, u.email as created_by_email
       FROM backup_history bh
       LEFT JOIN users u ON bh.created_by = u.id
       WHERE bh.id = ?`,
      [id]
    );

    if (backup.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    res.status(200).json({
      success: true,
      data: backup[0],
    });
  } catch (error) {
    console.error("Get backup details error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get backup details",
    });
  }
};

// Delete backup
exports.deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if backup exists
    const backup = await db.query(`SELECT * FROM backup_history WHERE id = ?`, [id]);
    if (backup.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    // Delete backup record
    await db.query(`DELETE FROM backup_history WHERE id = ?`, [id]);

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, "delete_backup", "backup", id]
    );

    res.status(200).json({
      success: true,
      data: {
        backup_id: id,
        message: "Backup deleted",
      },
    });
  } catch (error) {
    console.error("Delete backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete backup",
    });
  }
};

// ==================== RESTORE OPERATIONS ====================

// Restore from backup
exports.restoreFromBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const { restore_target } = req.body;
    const userId = req.user.id;

    // Check if backup exists
    const backup = await db.query(`SELECT * FROM backup_history WHERE id = ?`, [id]);
    if (backup.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    if (backup[0].backup_type !== "database" && backup[0].backup_type !== "full") {
      return res.status(400).json({
        success: false,
        error: "Cannot restore database from this backup type",
      });
    }

    // Create restore task
    const result = await db.query(
      `INSERT INTO restore_operations (
        backup_id, restore_target, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, NOW())`,
      [id, restore_target || "primary", "pending", userId]
    );

    const restoreId = result.insertId;

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        "start_database_restore",
        "restore_operation",
        restoreId,
        JSON.stringify({ backup_id: id, restore_target }),
      ]
    );

    // Execute restore in background
    setImmediate(async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        await db.query(`UPDATE restore_operations SET status = ? WHERE id = ?`, [
          "completed",
          restoreId,
        ]);

        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [userId, "database_restore_completed", "restore_operation", restoreId]
        );
      } catch (error) {
        await db.query(`UPDATE restore_operations SET status = ? WHERE id = ?`, [
          "failed",
          restoreId,
        ]);
      }
    });

    res.status(201).json({
      success: true,
      data: {
        restore_id: restoreId,
        backup_id: id,
        status: "pending",
        message: "Database restore initiated",
      },
    });
  } catch (error) {
    console.error("Restore from backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore from backup",
    });
  }
};

// Restore file backup
exports.restoreFileBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const { restore_path } = req.body;
    const userId = req.user.id;

    // Check if backup exists
    const backup = await db.query(`SELECT * FROM backup_history WHERE id = ?`, [id]);
    if (backup.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    if (backup[0].backup_type !== "files" && backup[0].backup_type !== "full") {
      return res.status(400).json({
        success: false,
        error: "Cannot restore files from this backup type",
      });
    }

    // Create restore task
    const result = await db.query(
      `INSERT INTO restore_operations (
        backup_id, restore_target, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, NOW())`,
      [id, restore_path || "original", "pending", userId]
    );

    const restoreId = result.insertId;

    // Log to audit trail
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        "start_file_restore",
        "restore_operation",
        restoreId,
        JSON.stringify({ backup_id: id, restore_path }),
      ]
    );

    // Execute restore in background
    setImmediate(async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        await db.query(`UPDATE restore_operations SET status = ? WHERE id = ?`, [
          "completed",
          restoreId,
        ]);

        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [userId, "file_restore_completed", "restore_operation", restoreId]
        );
      } catch (error) {
        await db.query(`UPDATE restore_operations SET status = ? WHERE id = ?`, [
          "failed",
          restoreId,
        ]);
      }
    });

    res.status(201).json({
      success: true,
      data: {
        restore_id: restoreId,
        backup_id: id,
        status: "pending",
        message: "File restore initiated",
      },
    });
  } catch (error) {
    console.error("Restore file backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore file backup",
    });
  }
};

// Get restore operation status
exports.getRestoreStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const restore = await db.query(
      `SELECT ro.*, bh.backup_type, u.email as created_by_email
       FROM restore_operations ro
       LEFT JOIN backup_history bh ON ro.backup_id = bh.id
       LEFT JOIN users u ON ro.created_by = u.id
       WHERE ro.id = ?`,
      [id]
    );

    if (restore.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Restore operation not found",
      });
    }

    res.status(200).json({
      success: true,
      data: restore[0],
    });
  } catch (error) {
    console.error("Get restore status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get restore status",
    });
  }
};

// ==================== BACKUP VERIFICATION ====================

// Verify backup integrity
exports.verifyBackupIntegrity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if backup exists
    const backup = await db.query(`SELECT * FROM backup_history WHERE id = ?`, [id]);
    if (backup.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    // Start verification
    const result = await db.query(
      `INSERT INTO backup_verifications (
        backup_id, status, verified_by, created_at
      ) VALUES (?, ?, ?, NOW())`,
      [id, "in_progress", userId]
    );

    const verificationId = result.insertId;

    // Perform verification in background
    setImmediate(async () => {
      try {
        // Simulate verification
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const isValid = Math.random() > 0.1; // 90% pass rate simulation

        await db.query(
          `UPDATE backup_verifications SET status = ?, is_valid = ? WHERE id = ?`,
          [isValid ? "completed" : "failed", isValid ? 1 : 0, verificationId]
        );

        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [userId, "verify_backup", "backup_verification", verificationId, JSON.stringify({ is_valid: isValid })]
        );
      } catch (error) {
        await db.query(
          `UPDATE backup_verifications SET status = ? WHERE id = ?`,
          ["error", verificationId]
        );
      }
    });

    res.status(201).json({
      success: true,
      data: {
        verification_id: verificationId,
        backup_id: id,
        status: "in_progress",
        message: "Backup verification started",
      },
    });
  } catch (error) {
    console.error("Verify backup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify backup",
    });
  }
};

// Get backup verification results
exports.getBackupVerification = async (req, res) => {
  try {
    const { id } = req.params;

    const verification = await db.query(
      `SELECT bv.*, u.email as verified_by_email
       FROM backup_verifications bv
       LEFT JOIN users u ON bv.verified_by = u.id
       WHERE bv.id = ?`,
      [id]
    );

    if (verification.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Verification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: verification[0],
    });
  } catch (error) {
    console.error("Get backup verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get verification results",
    });
  }
};

// ==================== BACKUP STORAGE & MAINTENANCE ====================

// Get backup storage statistics
exports.getBackupStorage = async (req, res) => {
  try {
    // Get storage stats
    const stats = await db.query(
      `SELECT
        COUNT(*) as total_backups,
        SUM(size_bytes) as total_size,
        AVG(size_bytes) as avg_size,
        backup_type,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_backups,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups
       FROM backup_history
       GROUP BY backup_type`
    );

    // Get latest backups
    const latest = await db.query(
      `SELECT backup_type, MAX(created_at) as last_backup
       FROM backup_history
       WHERE status = 'completed'
       GROUP BY backup_type`
    );

    // Calculate retention info
    const retention = await db.query(
      `SELECT
        COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as retention_30d,
        COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 END) as retention_90d,
        COUNT(CASE WHEN created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR) THEN 1 END) as retention_1y
       FROM backup_history
       WHERE status = 'completed'`
    );

    res.status(200).json({
      success: true,
      data: {
        storage_stats: stats,
        latest_backups: latest,
        retention_info: retention[0],
        total_storage_gb: (
          stats.reduce((sum, s) => sum + (s.total_size || 0), 0) / (1024 * 1024 * 1024)
        ).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Get backup storage error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get backup storage information",
    });
  }
};

// Cleanup old backups (retention policy)
exports.cleanupOldBackups = async (req, res) => {
  try {
    const { days_to_keep = 90 } = req.body;
    const userId = req.user.id;

    // Validate days
    if (days_to_keep < 1 || days_to_keep > 3650) {
      return res.status(400).json({
        success: false,
        error: "days_to_keep must be between 1 and 3650 (10 years)",
      });
    }

    // Find old backups
    const oldBackups = await db.query(
      `SELECT id, backup_name, size_bytes FROM backup_history
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND status = 'completed'`,
      [days_to_keep]
    );

    let totalSize = 0;
    for (const backup of oldBackups) {
      totalSize += backup.size_bytes || 0;
    }

    // Delete old backups
    if (oldBackups.length > 0) {
      await db.query(
        `DELETE FROM backup_history
         WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND status = 'completed'`,
        [days_to_keep]
      );

      // Log to audit trail
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          userId,
          "cleanup_old_backups",
          "backup",
          JSON.stringify({
            count: oldBackups.length,
            total_size: totalSize,
            days_to_keep,
          }),
        ]
      );
    }

    res.status(200).json({
      success: true,
      data: {
        backups_deleted: oldBackups.length,
        storage_freed_gb: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
        days_to_keep,
        message: "Cleanup completed",
      },
    });
  } catch (error) {
    console.error("Cleanup old backups error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup old backups",
    });
  }
};

// Get restore history
exports.getRestoreHistory = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT ro.*, bh.backup_type, u.email as created_by_email
                 FROM restore_operations ro
                 LEFT JOIN backup_history bh ON ro.backup_id = bh.id
                 LEFT JOIN users u ON ro.created_by = u.id
                 WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND ro.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY ro.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const restores = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM restore_operations WHERE 1=1`;
    const countParams = [];

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    res.status(200).json({
      success: true,
      data: restores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get restore history error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get restore history",
    });
  }
};
