/**
 * Migration: Create QuoteItems Table
 * Description: Creates the quote_items table for line items in quotes
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS quote_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      quote_id BIGINT NOT NULL,
      description VARCHAR(500),
      quantity INT,
      unit_price DECIMAL(12, 2),
      line_total DECIMAL(12, 2),
      FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
      INDEX idx_quote_id (quote_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS quote_items;");
};
