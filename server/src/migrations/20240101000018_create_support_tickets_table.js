/**
 * Migration: Create SupportTickets Table
 * Description: Creates the support_tickets table for issue tracking
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      ticket_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
      status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
      assigned_to BIGINT,
      created_by BIGINT,
      resolved_at TIMESTAMP NULL,
      resolution_time_minutes INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_ticket_id (ticket_id),
      INDEX idx_client_id (client_id),
      INDEX idx_status (status),
      INDEX idx_priority (priority),
      INDEX idx_assigned_to (assigned_to),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS support_tickets;");
};
