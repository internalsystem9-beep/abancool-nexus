/**
 * Migration: Create AuditLogs Table
 * Description: Creates the audit_logs table for comprehensive action tracking
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT,
      action VARCHAR(255) NOT NULL,
      resource_type VARCHAR(100),
      resource_id BIGINT,
      old_values JSON,
      new_values JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      status ENUM('success', 'failure') DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      INDEX idx_resource_type (resource_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS audit_logs;");
};
