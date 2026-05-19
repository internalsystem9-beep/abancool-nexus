/**
 * Migration: Create UserClients Table
 * Description: Creates the user_clients table for user-client assignments
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_clients (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      client_id BIGINT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_client (user_id, client_id),
      INDEX idx_user_id (user_id),
      INDEX idx_client_id (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS user_clients;");
};
