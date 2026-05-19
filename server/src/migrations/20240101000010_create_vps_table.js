/**
 * Migration: Create VPS Table
 * Description: Creates the vps table for VPS server management with resource metrics
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS vps (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      vps_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT,
      server_name VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) UNIQUE NOT NULL,
      provider VARCHAR(100),
      cpu_cores INT,
      ram_gb INT,
      storage_gb INT,
      cpu_usage_percent DECIMAL(5, 2) DEFAULT 0,
      ram_usage_percent DECIMAL(5, 2) DEFAULT 0,
      disk_usage_percent DECIMAL(5, 2) DEFAULT 0,
      uptime_percent DECIMAL(5, 2) DEFAULT 100,
      status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
      last_metrics_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      INDEX idx_vps_id (vps_id),
      INDEX idx_ip_address (ip_address),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS vps;");
};
