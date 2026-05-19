/**
 * Migration: Create Projects Table
 * Description: Creates the projects table with budget tracking and deployment URLs
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      project_id VARCHAR(50) UNIQUE NOT NULL,
      client_id BIGINT NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      description TEXT,
      status ENUM('planning', 'in_progress', 'testing', 'deployed', 'completed') DEFAULT 'planning',
      budget DECIMAL(12, 2),
      spent DECIMAL(12, 2) DEFAULT 0,
      deadline DATE,
      deployment_url VARCHAR(500),
      deployed_at TIMESTAMP NULL,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_project_id (project_id),
      INDEX idx_client_id (client_id),
      INDEX idx_status (status),
      INDEX idx_deadline (deadline),
      INDEX idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS projects;");
};
