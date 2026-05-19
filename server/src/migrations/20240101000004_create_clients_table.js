/**
 * Migration: Create Clients Table
 * Description: Creates the clients table with company information and soft-delete support
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS clients (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      client_id VARCHAR(50) UNIQUE NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      kra_pin VARCHAR(50),
      status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_client_id (client_id),
      INDEX idx_email (email),
      INDEX idx_status (status),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS clients;");
};
