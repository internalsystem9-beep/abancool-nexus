/**
 * Migration: Create InvoiceItems Table
 * Description: Creates the invoice_items table for line items in invoices
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS invoice_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      invoice_id BIGINT NOT NULL,
      description VARCHAR(500),
      quantity INT,
      unit_price DECIMAL(12, 2),
      line_total DECIMAL(12, 2),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      INDEX idx_invoice_id (invoice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS invoice_items;");
};
