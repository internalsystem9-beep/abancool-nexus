/**
 * Migration: Create Notifications Table
 * Description: Creates the notifications table for real-time notifications
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      notification_type VARCHAR(100),
      related_resource_type VARCHAR(100),
      related_resource_id BIGINT,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS notifications;");
};
