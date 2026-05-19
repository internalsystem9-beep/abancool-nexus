/**
 * Migration: Create Users Table
 * Description: Creates the users table with authentication fields, 2FA support, and audit fields
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      avatar_url VARCHAR(500),
      status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
      totp_secret VARCHAR(255),
      totp_enabled BOOLEAN DEFAULT FALSE,
      last_login_at TIMESTAMP NULL,
      last_login_ip VARCHAR(45),
      last_login_user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      INDEX idx_email (email),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS users;");
};
