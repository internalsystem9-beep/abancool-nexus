/**
 * Migration: Create Transactions Table
 * Description: Creates the transactions table for payment tracking
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      transaction_id VARCHAR(50) UNIQUE NOT NULL,
      invoice_id BIGINT,
      payment_method ENUM('mpesa', 'intasend', 'paystack', 'bank_transfer', 'cash') NOT NULL,
      amount DECIMAL(12, 2),
      currency VARCHAR(3) DEFAULT 'KES',
      status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
      reference_number VARCHAR(255),
      gateway_response LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_invoice_id (invoice_id),
      INDEX idx_payment_method (payment_method),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS transactions;");
};
