/**
 * Migration: Create TicketComments Table
 * Description: Creates the ticket_comments table for support ticket comments
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      ticket_id BIGINT NOT NULL,
      author_id BIGINT NOT NULL,
      comment_text TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ticket_id (ticket_id),
      INDEX idx_author_id (author_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS ticket_comments;");
};
