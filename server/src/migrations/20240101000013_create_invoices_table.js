/**
 * Migration: Create Invoices Table
 * Description: Creates the invoices table for billing with tax calculations
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS invoices (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      invoice_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT NOT NULL,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      subtotal DECIMAL(12, 2),
      tax_amount DECIMAL(12, 2),
      total_amount DECIMAL(12, 2),
      tax_rate DECIMAL(5, 2),
      status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
      payment_status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
      due_date DATE,
      paid_at TIMESTAMP NULL,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_invoice_id (invoice_id),
      INDEX idx_invoice_number (invoice_number),
      INDEX idx_client_id (client_id),
      INDEX idx_status (status),
      INDEX idx_due_date (due_date),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS invoices;");
};
