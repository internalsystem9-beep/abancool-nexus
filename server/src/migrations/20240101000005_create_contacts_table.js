/**
 * Migration: Create Contacts Table
 * Description: Creates the contacts table for client contact information
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS contacts (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      client_id BIGINT NOT NULL,
      contact_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(20),
      role VARCHAR(100),
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      INDEX idx_client_id (client_id),
      INDEX idx_email (email),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS contacts;");
};
