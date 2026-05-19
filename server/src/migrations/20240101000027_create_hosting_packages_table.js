/**
 * Migration: Create Hosting Packages Table
 * Description: Creates the hosting_packages table for storing hosting packages with pricing and features
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS hosting_packages (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      package_id VARCHAR(50) UNIQUE NOT NULL,
      package_name VARCHAR(100) UNIQUE NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      disk_space_gb INT NOT NULL,
      bandwidth_gb INT NOT NULL,
      features TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      INDEX idx_package_id (package_id),
      INDEX idx_package_name (package_name),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS hosting_packages;");
};
