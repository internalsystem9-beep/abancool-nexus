/**
 * Password Vault Controller
 * Handles encrypted credential storage, retrieval, and management
 */

const db = require("../config/db");
const crypto = require("crypto");
const { z } = require("zod");

// Encryption constants
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment (should be 32 bytes for AES-256)
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || "default-32-byte-key-for-testing!";
  if (key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 bytes");
  }
  return Buffer.from(key.substring(0, 32), "utf-8");
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
function encryptPassword(plaintext) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, "utf-8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = iv.toString("hex") + "|" + authTag.toString("hex") + "|" + encrypted;
    return combined;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt AES-256-GCM encrypted data
 */
function decryptPassword(encryptedData) {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split("|");
    
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }
    
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generate unique vault ID
 */
function generateVaultId() {
  return "VAULT_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Log vault access/action to audit
 */
async function logVaultAudit(userId, action, vaultId, details, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";
    
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, ?, 'password_vault', ?, ?, ?, ?, NOW())`,
      [userId, action, vaultId, JSON.stringify(details || {}), ip, userAgent]
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
    // Don't fail the main operation if audit logging fails
  }
}

// Validation schemas
const createVaultSchema = z.object({
  credential_type: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1000),
});

const updateVaultSchema = z.object({
  credential_type: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(255).optional(),
  username: z.string().min(1).max(255).optional(),
  password: z.string().min(1).max(1000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

/**
 * List password vault entries
 * GET /api/vault
 */
async function list(req, res, next) {
  try {
    const { credential_type, label, status, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT 
        id, vault_id, credential_type, label, username, status, created_at, updated_at
      FROM password_vault
      WHERE owner_id = ? AND deleted_at IS NULL
    `;
    const params = [userId];

    if (credential_type) {
      query += ` AND credential_type = ?`;
      params.push(credential_type);
    }

    if (label) {
      query += ` AND label LIKE ?`;
      params.push(`%${label}%`);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const vaults = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM password_vault WHERE owner_id = ? AND deleted_at IS NULL`;
    const countParams = [userId];

    if (credential_type) {
      countQuery += ` AND credential_type = ?`;
      countParams.push(credential_type);
    }

    if (label) {
      countQuery += ` AND label LIKE ?`;
      countParams.push(`%${label}%`);
    }

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    // Log access
    await logVaultAudit(userId, "vault_list_accessed", null, { count: vaults.length }, req);

    res.json({
      success: true,
      data: vaults,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: vaults.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single vault entry
 * GET /api/vault/:id
 */
async function get(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch vault entry
    const result = await db.query(
      `SELECT * FROM password_vault 
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vault entry not found",
      });
    }

    const vault = result[0];

    // Decrypt password
    let decryptedPassword;
    try {
      decryptedPassword = decryptPassword(vault.encrypted_password);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to decrypt password",
      });
    }

    // Log access
    await logVaultAudit(userId, "vault_entry_accessed", id, { label: vault.label }, req);

    res.json({
      success: true,
      data: {
        vault_id: vault.vault_id,
        credential_type: vault.credential_type,
        label: vault.label,
        username: vault.username,
        password: decryptedPassword, // Only return plaintext password to authorized user
        status: vault.status,
        created_at: vault.created_at,
        updated_at: vault.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new vault entry
 * POST /api/vault
 */
async function create(req, res, next) {
  try {
    const userId = req.user.id;

    // Validate input
    const validationResult = createVaultSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { credential_type, label, username, password } = validationResult.data;

    // Encrypt password
    let encryptedPassword;
    try {
      encryptedPassword = encryptPassword(password);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to encrypt password",
      });
    }

    // Generate vault ID
    const vaultId = generateVaultId();

    // Insert into database
    const result = await db.query(
      `INSERT INTO password_vault (vault_id, owner_id, credential_type, label, username, encrypted_password, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [vaultId, userId, credential_type, label, username, encryptedPassword]
    );

    // Log audit
    await logVaultAudit(userId, "vault_entry_created", vaultId, { credential_type, label }, req);

    res.status(201).json({
      success: true,
      message: "Vault entry created successfully",
      data: {
        vault_id: vaultId,
        credential_type,
        label,
        username,
        status: "active",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update vault entry
 * PUT /api/vault/:id
 */
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Validate input
    const validationResult = updateVaultSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    // Check if vault entry exists
    const result = await db.query(
      `SELECT * FROM password_vault 
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vault entry not found",
      });
    }

    const vault = result[0];
    const updates = validationResult.data;

    // Build update query
    const updateFields = [];
    const params = [];

    if (updates.credential_type !== undefined) {
      updateFields.push("credential_type = ?");
      params.push(updates.credential_type);
    }

    if (updates.label !== undefined) {
      updateFields.push("label = ?");
      params.push(updates.label);
    }

    if (updates.username !== undefined) {
      updateFields.push("username = ?");
      params.push(updates.username);
    }

    if (updates.password !== undefined) {
      try {
        const encryptedPassword = encryptPassword(updates.password);
        updateFields.push("encrypted_password = ?");
        params.push(encryptedPassword);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to encrypt password",
        });
      }
    }

    if (updates.status !== undefined) {
      updateFields.push("status = ?");
      params.push(updates.status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update",
      });
    }

    updateFields.push("updated_at = NOW()");
    params.push(id, userId);

    await db.query(
      `UPDATE password_vault 
       SET ${updateFields.join(", ")}
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      params
    );

    // Log audit
    await logVaultAudit(userId, "vault_entry_updated", id, { updates }, req);

    res.json({
      success: true,
      message: "Vault entry updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Soft-delete vault entry
 * DELETE /api/vault/:id
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if vault entry exists
    const result = await db.query(
      `SELECT * FROM password_vault 
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vault entry not found",
      });
    }

    const vault = result[0];

    // Soft delete
    await db.query(
      `UPDATE password_vault 
       SET deleted_at = NOW() 
       WHERE vault_id = ? AND owner_id = ?`,
      [id, userId]
    );

    // Log audit
    await logVaultAudit(userId, "vault_entry_deleted", id, { label: vault.label }, req);

    res.json({
      success: true,
      message: "Vault entry deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive vault entry (status change without deletion)
 * PATCH /api/vault/:id/archive
 */
async function archive(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if vault entry exists
    const result = await db.query(
      `SELECT * FROM password_vault 
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vault entry not found",
      });
    }

    const vault = result[0];

    // Check current status
    if (vault.status === "archived") {
      return res.status(400).json({
        success: false,
        error: "Entry is already archived",
      });
    }

    // Update status to archived
    await db.query(
      `UPDATE password_vault 
       SET status = 'archived', updated_at = NOW()
       WHERE vault_id = ? AND owner_id = ?`,
      [id, userId]
    );

    // Log audit
    await logVaultAudit(userId, "vault_entry_archived", id, { label: vault.label }, req);

    res.json({
      success: true,
      message: "Vault entry archived successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Restore archived vault entry
 * PATCH /api/vault/:id/restore
 */
async function restore(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if vault entry exists
    const result = await db.query(
      `SELECT * FROM password_vault 
       WHERE vault_id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vault entry not found",
      });
    }

    const vault = result[0];

    // Check current status
    if (vault.status === "active") {
      return res.status(400).json({
        success: false,
        error: "Entry is already active",
      });
    }

    // Update status to active
    await db.query(
      `UPDATE password_vault 
       SET status = 'active', updated_at = NOW()
       WHERE vault_id = ? AND owner_id = ?`,
      [id, userId]
    );

    // Log audit
    await logVaultAudit(userId, "vault_entry_restored", id, { label: vault.label }, req);

    res.json({
      success: true,
      message: "Vault entry restored successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get vault statistics
 * GET /api/vault/stats
 */
async function getStats(req, res, next) {
  try {
    const userId = req.user.id;

    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_count,
        COUNT(DISTINCT credential_type) as credential_types
      FROM password_vault
      WHERE owner_id = ? AND deleted_at IS NULL
    `;

    const stats = await db.query(statsQuery, [userId]);

    // Log access
    await logVaultAudit(userId, "vault_stats_accessed", null, {}, req);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  archive,
  restore,
  getStats,
};
