/**
 * Migration: Create Notifications Table
 * Description: Creates the notifications table for tracking project and system notifications
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      project_id BIGINT,
      type VARCHAR(50) NOT NULL,
      message TEXT,
      recipient_email VARCHAR(255),
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      INDEX idx_project_id (project_id),
      INDEX idx_type (type),
      INDEX idx_created_at (created_at),
      INDEX idx_is_read (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS notifications;");
};
