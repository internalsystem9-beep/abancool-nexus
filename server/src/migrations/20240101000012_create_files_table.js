/**
 * Migration: Create Files Table
 * Description: Creates the files table for file management with download tokens
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS files (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      file_id VARCHAR(50) UNIQUE NOT NULL,
      project_id BIGINT,
      original_filename VARCHAR(500) NOT NULL,
      stored_filename VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100),
      file_size_bytes BIGINT,
      storage_path VARCHAR(500),
      download_token VARCHAR(255) UNIQUE,
      download_token_expires_at TIMESTAMP,
      download_count INT DEFAULT 0,
      uploaded_by BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_file_id (file_id),
      INDEX idx_project_id (project_id),
      INDEX idx_download_token (download_token),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS files;");
};
