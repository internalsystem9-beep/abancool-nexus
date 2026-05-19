/**
 * Migration: Create Quotes Table
 * Description: Creates the quotes table for pricing proposals
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS quotes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      quote_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT NOT NULL,
      quote_number VARCHAR(50) UNIQUE NOT NULL,
      subtotal DECIMAL(12, 2),
      tax_amount DECIMAL(12, 2),
      total_amount DECIMAL(12, 2),
      tax_rate DECIMAL(5, 2),
      status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') DEFAULT 'draft',
      expiration_date DATE,
      converted_to_invoice_id BIGINT,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_quote_id (quote_id),
      INDEX idx_client_id (client_id),
      INDEX idx_status (status),
      INDEX idx_expiration_date (expiration_date),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS quotes;");
};
