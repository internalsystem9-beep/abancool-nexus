/**
 * Migration: Create Domains Table
 * Description: Creates the domains table with SSL tracking and renewal management
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS domains (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      domain_id VARCHAR(50) UNIQUE NOT NULL,
      domain_name VARCHAR(255) UNIQUE NOT NULL,
      registrar VARCHAR(100),
      registration_date DATE,
      expiration_date DATE,
      auto_renewal BOOLEAN DEFAULT FALSE,
      ssl_issuer VARCHAR(100),
      ssl_expiration_date DATE,
      ssl_renewal_status ENUM('active', 'expiring_soon', 'expired') DEFAULT 'active',
      status ENUM('active', 'expired', 'pending') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      INDEX idx_domain_id (domain_id),
      INDEX idx_domain_name (domain_name),
      INDEX idx_expiration_date (expiration_date),
      INDEX idx_ssl_expiration_date (ssl_expiration_date),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS domains;");
};
