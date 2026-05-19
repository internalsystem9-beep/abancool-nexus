/**
 * Migration: Create PasswordVault Table
 * Description: Creates the password_vault table for encrypted credential storage
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_vault (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      vault_id VARCHAR(50) UNIQUE NOT NULL,
      owner_id BIGINT NOT NULL,
      credential_type VARCHAR(100),
      label VARCHAR(255) NOT NULL,
      username VARCHAR(255),
      encrypted_password LONGTEXT NOT NULL,
      encryption_key_id VARCHAR(50),
      status ENUM('active', 'archived') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_vault_id (vault_id),
      INDEX idx_owner_id (owner_id),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS password_vault;");
};
