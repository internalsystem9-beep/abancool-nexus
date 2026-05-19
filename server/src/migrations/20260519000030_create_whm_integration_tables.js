-- WHM Integration Database Tables

-- Hosting Accounts Table
CREATE TABLE IF NOT EXISTS hosting_accounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16) UNIQUE NOT NULL,
  domain VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  plan VARCHAR(100),
  status ENUM('active', 'suspended', 'terminated') DEFAULT 'active',
  account_id VARCHAR(255),
  bandwidth_limit VARCHAR(50),
  disk_limit VARCHAR(50),
  suspended_reason TEXT,
  suspended_at TIMESTAMP NULL,
  password_changed_at TIMESTAMP NULL,
  upgraded_at TIMESTAMP NULL,
  terminated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_username (username),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hosting Packages Table
CREATE TABLE IF NOT EXISTS hosting_packages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  feature_list VARCHAR(255),
  max_addon INT DEFAULT 0,
  max_park INT DEFAULT 0,
  max_sql INT DEFAULT 0,
  max_pop INT DEFAULT 0,
  max_email INT DEFAULT 0,
  max_list INT DEFAULT 0,
  max_forwarders INT DEFAULT 0,
  disk_space VARCHAR(50),
  bandwidth VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bandwidth Usage Table
CREATE TABLE IF NOT EXISTS bandwidth_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16) NOT NULL,
  used_gb DECIMAL(10, 2),
  limit_gb DECIMAL(10, 2),
  percent_used DECIMAL(5, 2),
  snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE CASCADE,
  INDEX idx_username (username),
  INDEX idx_snapshot_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bandwidth Alerts Table
CREATE TABLE IF NOT EXISTS bandwidth_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16) NOT NULL,
  percent_used DECIMAL(5, 2),
  bandwidth_limit VARCHAR(50),
  alert_type VARCHAR(50),
  acknowledged_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE CASCADE,
  INDEX idx_username (username),
  INDEX idx_alert_type (alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSL Certificates Table
CREATE TABLE IF NOT EXISTS ssl_certificates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16),
  domain VARCHAR(255) UNIQUE NOT NULL,
  certificate LONGTEXT,
  private_key LONGTEXT,
  ca_bundle LONGTEXT,
  status ENUM('active', 'inactive', 'expired') DEFAULT 'inactive',
  expires_at TIMESTAMP NULL,
  installed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE SET NULL,
  INDEX idx_domain (domain),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSL CSRs Table
CREATE TABLE IF NOT EXISTS ssl_csrs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  csr LONGTEXT,
  private_key LONGTEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE CASCADE,
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSL Alerts Table
CREATE TABLE IF NOT EXISTS ssl_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16),
  domain VARCHAR(255),
  alert_type VARCHAR(50),
  message TEXT,
  acknowledged_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE SET NULL,
  INDEX idx_domain (domain),
  INDEX idx_alert_type (alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login Sessions Table
CREATE TABLE IF NOT EXISTS login_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16),
  session_hash VARCHAR(255) UNIQUE NOT NULL,
  redirect_url VARCHAR(2048),
  session_url VARCHAR(2048),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE CASCADE,
  INDEX idx_session_hash (session_hash),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SSO Links Table
CREATE TABLE IF NOT EXISTS sso_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(16),
  sso_hash VARCHAR(255) UNIQUE NOT NULL,
  return_url VARCHAR(2048),
  expires_at TIMESTAMP,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (username) REFERENCES hosting_accounts(username) ON DELETE CASCADE,
  INDEX idx_sso_hash (sso_hash),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DNS Zones Table
CREATE TABLE IF NOT EXISTS dns_zones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  domain VARCHAR(255) UNIQUE NOT NULL,
  nameserver1 VARCHAR(255),
  nameserver2 VARCHAR(255),
  nameserver3 VARCHAR(255),
  nameserver4 VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DNS Parked Table
CREATE TABLE IF NOT EXISTS dns_parked (
  id INT PRIMARY KEY AUTO_INCREMENT,
  domain VARCHAR(255) UNIQUE NOT NULL,
  target VARCHAR(255),
  parked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DNS Records Table
CREATE TABLE IF NOT EXISTS dns_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  domain VARCHAR(255) NOT NULL,
  record_type VARCHAR(10),
  name VARCHAR(255),
  value VARCHAR(255),
  priority INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (domain) REFERENCES dns_zones(domain) ON DELETE CASCADE,
  INDEX idx_domain (domain),
  INDEX idx_record_type (record_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
