const db = require("../config/db");

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','staff','client') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    company VARCHAR(160),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clients_email (email)
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS hosting_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    domain VARCHAR(255) NOT NULL,
    plan VARCHAR(80),
    status ENUM('active','suspended','cancelled') DEFAULT 'active',
    expires_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    name VARCHAR(255) NOT NULL UNIQUE,
    registrar VARCHAR(120),
    status ENUM('active','expired','pending') DEFAULT 'active',
    expires_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency CHAR(3) DEFAULT 'KES',
    status ENUM('draft','sent','paid','overdue','void') DEFAULT 'draft',
    issued_at DATE,
    due_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    subject VARCHAR(255) NOT NULL,
    status ENUM('open','pending','resolved','closed') DEFAULT 'open',
    priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  `CREATE TABLE IF NOT EXISTS vault_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    category ENUM('login','ssh','api','note') DEFAULT 'login',
    cipher_text TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,
];

(async () => {
  try {
    for (const sql of statements) {
      await db.query(sql);
      console.log("[migrate] ✔", sql.split("\n")[0]);
    }
    console.log("[migrate] complete");
    process.exit(0);
  } catch (err) {
    console.error("[migrate] failed", err);
    process.exit(1);
  }
})();
