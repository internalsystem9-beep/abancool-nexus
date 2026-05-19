/**
 * Migration: Create ProjectTeam Table
 * Description: Creates the project_team table for team member assignments
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS project_team (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      project_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      role VARCHAR(100),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_project_user (project_id, user_id),
      INDEX idx_project_id (project_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS project_team;");
};
