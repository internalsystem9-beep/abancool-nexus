/**
 * File Management Controller
 * Handles file upload, download, storage, and access management
 */

const db = require("../config/db");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { z } = require("zod");

// File constraints
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/json",
  "application/xml",
  "text/xml",
];

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");

/**
 * Ensure uploads directory exists
 */
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generate unique file ID
 */
function generateFileId() {
  return "FILE_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Generate secure download token
 */
function generateDownloadToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate download token expiration (24 hours from now)
 */
function getTokenExpiration() {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

/**
 * Log file access/action to audit
 */
async function logFileAudit(userId, action, fileId, details, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, ?, 'file', ?, ?, ?, ?, NOW())`,
      [userId, action, fileId, JSON.stringify(details || {}), ip, userAgent]
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}

// Validation schemas
const uploadFileSchema = z.object({
  project_id: z.number().int().positive().optional(),
});

/**
 * List files
 * GET /api/files
 */
async function list(req, res, next) {
  try {
    const { project_id, mime_type, start_date, end_date, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT 
        id, file_id, project_id, original_filename, mime_type, file_size_bytes, 
        download_count, uploaded_by, created_at, updated_at
      FROM files
      WHERE uploaded_by = ? AND deleted_at IS NULL
    `;
    const params = [userId];

    if (project_id) {
      query += ` AND project_id = ?`;
      params.push(parseInt(project_id, 10));
    }

    if (mime_type) {
      query += ` AND mime_type = ?`;
      params.push(mime_type);
    }

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(new Date(end_date));
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const files = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM files WHERE uploaded_by = ? AND deleted_at IS NULL`;
    const countParams = [userId];

    if (project_id) {
      countQuery += ` AND project_id = ?`;
      countParams.push(parseInt(project_id, 10));
    }

    if (mime_type) {
      countQuery += ` AND mime_type = ?`;
      countParams.push(mime_type);
    }

    if (start_date) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(new Date(start_date));
    }

    if (end_date) {
      countQuery += ` AND created_at <= ?`;
      countParams.push(new Date(end_date));
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    // Log access
    await logFileAudit(userId, "files_list_accessed", null, { count: files.length }, req);

    res.json({
      success: true,
      data: files,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: files.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get file details
 * GET /api/files/:id
 */
async function get(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM files 
       WHERE file_id = ? AND (uploaded_by = ? OR project_id IN (
         SELECT id FROM projects WHERE id IN (
           SELECT project_id FROM project_team WHERE user_id = ?
         )
       )) AND deleted_at IS NULL`,
      [id, userId, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const file = result[0];

    // Log access
    await logFileAudit(userId, "file_details_accessed", id, { filename: file.original_filename }, req);

    res.json({
      success: true,
      data: {
        file_id: file.file_id,
        project_id: file.project_id,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        file_size_bytes: file.file_size_bytes,
        download_count: file.download_count,
        uploaded_by: file.uploaded_by,
        created_at: file.created_at,
        updated_at: file.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload file
 * POST /api/files/upload
 */
async function upload(req, res, next) {
  try {
    ensureUploadsDir();

    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const uploadedFile = req.files.file;
    const userId = req.user.id;

    // Validate request body
    const validationResult = uploadFileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { project_id } = validationResult.data;

    // Validate file size
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type ${uploadedFile.mimetype} not allowed`,
      });
    }

    // Validate project_id exists if provided
    if (project_id) {
      const projectResult = await db.query(
        `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`,
        [project_id]
      );

      if (projectResult.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Project not found",
        });
      }
    }

    // Generate file identifiers
    const fileId = generateFileId();
    const downloadToken = generateDownloadToken();
    const tokenExpiration = getTokenExpiration();
    const storedFilename = `${fileId}_${Date.now()}${path.extname(uploadedFile.name)}`;
    const storagePath = path.join(UPLOADS_DIR, storedFilename);

    // Save file to disk
    await uploadedFile.mv(storagePath);

    // Insert into database
    const result = await db.query(
      `INSERT INTO files (file_id, project_id, original_filename, stored_filename, mime_type, file_size_bytes, storage_path, download_token, download_token_expires_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fileId, project_id || null, uploadedFile.name, storedFilename, uploadedFile.mimetype, uploadedFile.size, storagePath, downloadToken, tokenExpiration, userId]
    );

    // Log audit
    await logFileAudit(userId, "file_uploaded", fileId, { filename: uploadedFile.name, size: uploadedFile.size, project_id }, req);

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        file_id: fileId,
        project_id,
        original_filename: uploadedFile.name,
        mime_type: uploadedFile.mimetype,
        file_size_bytes: uploadedFile.size,
        download_token: downloadToken,
        download_token_expires_at: tokenExpiration,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Download file
 * GET /api/files/:id/download
 */
async function download(req, res, next) {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const userId = req.user.id;

    // Fetch file record
    const result = await db.query(
      `SELECT * FROM files 
       WHERE file_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const file = result[0];

    // Verify authorization (uploader or project team member)
    if (file.uploaded_by !== userId) {
      if (file.project_id) {
        const teamResult = await db.query(
          `SELECT id FROM project_team WHERE project_id = ? AND user_id = ?`,
          [file.project_id, userId]
        );

        if (teamResult.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Not authorized to download this file",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: "Not authorized to download this file",
        });
      }
    }

    // Verify download token if using token-based download
    if (token) {
      if (file.download_token !== token) {
        return res.status(401).json({
          success: false,
          error: "Invalid download token",
        });
      }

      if (new Date() > new Date(file.download_token_expires_at)) {
        return res.status(401).json({
          success: false,
          error: "Download token has expired",
        });
      }
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.storage_path)) {
      return res.status(404).json({
        success: false,
        error: "File not found on storage",
      });
    }

    // Increment download count
    await db.query(
      `UPDATE files SET download_count = download_count + 1 WHERE file_id = ?`,
      [id]
    );

    // Log download
    await logFileAudit(userId, "file_downloaded", id, { filename: file.original_filename }, req);

    // Send file
    res.download(file.storage_path, file.original_filename);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate new download token
 * POST /api/files/:id/token
 */
async function generateToken(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch file record
    const result = await db.query(
      `SELECT * FROM files 
       WHERE file_id = ? AND uploaded_by = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const file = result[0];

    // Generate new token
    const downloadToken = generateDownloadToken();
    const tokenExpiration = getTokenExpiration();

    // Update token in database
    await db.query(
      `UPDATE files 
       SET download_token = ?, download_token_expires_at = ?
       WHERE file_id = ?`,
      [downloadToken, tokenExpiration, id]
    );

    // Log audit
    await logFileAudit(userId, "download_token_generated", id, { filename: file.original_filename }, req);

    res.json({
      success: true,
      message: "Download token generated successfully",
      data: {
        file_id: id,
        download_token: downloadToken,
        download_token_expires_at: tokenExpiration,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete file (soft delete)
 * DELETE /api/files/:id
 */
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch file record
    const result = await db.query(
      `SELECT * FROM files 
       WHERE file_id = ? AND uploaded_by = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    const file = result[0];

    // Soft delete
    await db.query(
      `UPDATE files SET deleted_at = NOW() WHERE file_id = ?`,
      [id]
    );

    // Log audit
    await logFileAudit(userId, "file_deleted", id, { filename: file.original_filename }, req);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get file statistics
 * GET /api/files/stats
 */
async function getStats(req, res, next) {
  try {
    const userId = req.user.id;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size_bytes) as total_size_bytes,
        COUNT(DISTINCT project_id) as projects_count,
        COUNT(DISTINCT mime_type) as mime_types_count,
        SUM(download_count) as total_downloads
      FROM files
      WHERE uploaded_by = ? AND deleted_at IS NULL
    `;

    const stats = await db.query(statsQuery, [userId]);

    // Log access
    await logFileAudit(userId, "file_stats_accessed", null, {}, req);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get file storage analysis
 * GET /api/files/analysis
 */
async function getAnalysis(req, res, next) {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Top MIME types
    const mimeTypesQuery = `
      SELECT mime_type, COUNT(*) as count, SUM(file_size_bytes) as total_size
      FROM files
      WHERE uploaded_by = ? AND deleted_at IS NULL
      GROUP BY mime_type
      ORDER BY total_size DESC
      LIMIT ?
    `;
    const mimeTypes = await db.query(mimeTypesQuery, [userId, parseInt(limit, 10)]);

    // Top projects
    const projectsQuery = `
      SELECT p.id, p.project_name, COUNT(f.id) as file_count, SUM(f.file_size_bytes) as total_size
      FROM files f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE f.uploaded_by = ? AND f.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY total_size DESC
      LIMIT ?
    `;
    const projects = await db.query(projectsQuery, [userId, parseInt(limit, 10)]);

    // Log access
    await logFileAudit(userId, "file_analysis_accessed", null, {}, req);

    res.json({
      success: true,
      data: {
        mime_types: mimeTypes,
        projects: projects,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  upload,
  download,
  generateToken,
  remove,
  getStats,
  getAnalysis,
};
