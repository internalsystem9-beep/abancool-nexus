/**
 * Migration: Create SMSCampaigns Table
 * Description: Creates the sms_campaigns table for SMS campaign tracking
 */

exports.up = async (db) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      campaign_id VARCHAR(50) UNIQUE NOT NULL,
      campaign_name VARCHAR(255),
      message_template TEXT,
      provider ENUM('africas_talking', 'twilio') NOT NULL,
      recipient_count INT,
      sent_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
      scheduled_at TIMESTAMP NULL,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      created_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_status (status),
      INDEX idx_scheduled_at (scheduled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await db.query(sql);
};

exports.down = async (db) => {
  await db.query("DROP TABLE IF EXISTS sms_campaigns;");
};
