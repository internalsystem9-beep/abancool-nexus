/**
 * Migration: Create UserRoles Table
 * Description: Creates the user_roles table for RBAC with 6 predefined roles
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_roles (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      role ENUM('super_admin', 'admin', 'developer', 'support', 'finance', 'sales') NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_by BIGINT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_user_role (user_id, role),
      INDEX idx_user_id (user_id),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS user_roles;");
};
