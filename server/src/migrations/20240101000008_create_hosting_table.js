/**
 * Migration: Create Hosting Table
 * Description: Creates the hosting table for cPanel hosting accounts with resource tracking
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS hosting (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      hosting_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT NOT NULL,
      domain_name VARCHAR(255) NOT NULL,
      cpanel_account VARCHAR(100),
      package_type VARCHAR(100),
      disk_quota_gb INT,
      bandwidth_limit_gb INT,
      disk_used_gb DECIMAL(10, 2) DEFAULT 0,
      bandwidth_used_gb DECIMAL(10, 2) DEFAULT 0,
      renewal_date DATE,
      status ENUM('active', 'suspended', 'expired') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      INDEX idx_hosting_id (hosting_id),
      INDEX idx_client_id (client_id),
      INDEX idx_domain_name (domain_name),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS hosting;");
};
