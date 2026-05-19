const db = require("../config/db");
const nodemailer = require("nodemailer");
const { validateRequired, validateEmail, validateString } = require("../lib/validators");
const { getErrorMessage } = require("../lib/errors");

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// ==================== EMAIL SENDING ====================

/**
 * Send single email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendEmail = async (req, res) => {
  try {
    const { recipient_email, subject, body, html_content, template_id, template_variables } = req.body;
    const userId = req.user.id;

    if (!validateEmail(recipient_email)) {
      return res.status(400).json({ error: "Invalid recipient email address" });
    }

    if (!subject || !validateString(subject, 3, 200)) {
      return res.status(400).json({ error: "Subject is required and must be 3-200 characters" });
    }

    let emailBody = body;
    let emailHtml = html_content;

    // If template is used, fetch and process template
    if (template_id) {
      const templateResult = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [template_id]);

      if (templateResult.length === 0) {
        return res.status(404).json({ error: "Email template not found" });
      }

      const template = templateResult[0];
      emailBody = template.template_body;
      emailHtml = template.template_html;

      // Replace template variables
      if (template_variables) {
        Object.entries(template_variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          if (emailBody) emailBody = emailBody.replace(regex, value);
          if (emailHtml) emailHtml = emailHtml.replace(regex, value);
        });
      }
    }

    if (!emailBody && !emailHtml) {
      return res.status(400).json({ error: "Email body or HTML content is required" });
    }

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient_email,
      subject,
      text: emailBody,
      html: emailHtml,
    };

    let emailStatus = "sent";
    let sendError = null;

    try {
      const info = await emailTransporter.sendMail(mailOptions);
      console.log("Email sent:", info.response);
    } catch (err) {
      emailStatus = "failed";
      sendError = err.message;
    }

    // Store email log
    const result = await db.query(
      `INSERT INTO email_logs (user_id, recipient_email, subject, email_status, send_error, sent_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, recipient_email, subject, emailStatus, sendError]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'email_sent', 'email', ?, ?, ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ recipient: recipient_email, status: emailStatus }), req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        email_log_id: result.insertId,
        recipient_email,
        subject,
        status: emailStatus,
        error: sendError,
      },
    });
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Send bulk email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendBulkEmail = async (req, res) => {
  try {
    const { recipient_emails, subject, body, html_content, template_id, template_variables } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(recipient_emails) || recipient_emails.length === 0) {
      return res.status(400).json({ error: "At least one recipient email is required" });
    }

    if (recipient_emails.length > 1000) {
      return res.status(400).json({ error: "Maximum 1000 recipients allowed per bulk email" });
    }

    if (!subject || !validateString(subject, 3, 200)) {
      return res.status(400).json({ error: "Subject is required and must be 3-200 characters" });
    }

    let emailBody = body;
    let emailHtml = html_content;

    // If template is used, fetch and process template
    if (template_id) {
      const templateResult = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [template_id]);

      if (templateResult.length === 0) {
        return res.status(404).json({ error: "Email template not found" });
      }

      const template = templateResult[0];
      emailBody = template.template_body;
      emailHtml = template.template_html;
    }

    if (!emailBody && !emailHtml) {
      return res.status(400).json({ error: "Email body or HTML content is required" });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send to each recipient
    for (const recipientEmail of recipient_emails) {
      if (!validateEmail(recipientEmail)) {
        failedCount++;
        continue;
      }

      // Replace template variables per recipient if provided
      let finalBody = emailBody;
      let finalHtml = emailHtml;

      if (template_variables) {
        Object.entries(template_variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          if (finalBody) finalBody = finalBody.replace(regex, value);
          if (finalHtml) finalHtml = finalHtml.replace(regex, value);
        });
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipientEmail,
        subject,
        text: finalBody,
        html: finalHtml,
      };

      let emailStatus = "sent";
      let sendError = null;

      try {
        await emailTransporter.sendMail(mailOptions);
        sentCount++;
      } catch (err) {
        emailStatus = "failed";
        sendError = err.message;
        failedCount++;
      }

      // Log email
      await db.query(
        `INSERT INTO email_logs (user_id, recipient_email, subject, email_status, send_error, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, recipientEmail, subject, emailStatus, sendError]
      );
    }

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_type, changes, ip_address, user_agent, created_at)
       VALUES (?, 'bulk_email_sent', 'email', ?, ?, ?, ?, NOW())`,
      [userId, JSON.stringify({ recipients: recipient_emails.length, sent: sentCount, failed: failedCount }), req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        total_recipients: recipient_emails.length,
        sent_count: sentCount,
        failed_count: failedCount,
      },
    });
  } catch (error) {
    console.error("Send bulk email error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== EMAIL TEMPLATES ====================

/**
 * Create email template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createEmailTemplate = async (req, res) => {
  try {
    const { template_name, template_subject, template_body, template_html, description } = req.body;
    const userId = req.user.id;

    if (!validateRequired(template_name)) {
      return res.status(400).json({ error: "Template name is required" });
    }

    if (!validateString(template_name, 3, 100)) {
      return res.status(400).json({ error: "Template name must be 3-100 characters" });
    }

    if (!template_subject || !validateString(template_subject, 3, 200)) {
      return res.status(400).json({ error: "Template subject is required and must be 3-200 characters" });
    }

    if (!template_body && !template_html) {
      return res.status(400).json({ error: "Template body or HTML content is required" });
    }

    // Insert template
    const result = await db.query(
      `INSERT INTO email_templates (template_name, template_subject, template_body, template_html, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [template_name, template_subject, template_body, template_html, description, userId]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'template_created', 'email_template', ?, ?, ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ template_name }), req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        template_id: result.insertId,
        template_name,
        status: "created",
      },
    });
  } catch (error) {
    console.error("Create email template error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get email templates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM email_templates`);
    const total = countResult[0].total;

    // Get templates
    const templates = await db.query(`SELECT * FROM email_templates ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get email templates error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get email template by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [id]);

    if (template.length === 0) {
      return res.status(404).json({ error: "Email template not found" });
    }

    res.json({
      success: true,
      data: template[0],
    });
  } catch (error) {
    console.error("Get email template error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Update email template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { template_name, template_subject, template_body, template_html, description } = req.body;
    const userId = req.user.id;

    // Get current template
    const templateResult = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [id]);

    if (templateResult.length === 0) {
      return res.status(404).json({ error: "Email template not found" });
    }

    const updates = {};

    if (template_name) {
      if (!validateString(template_name, 3, 100)) {
        return res.status(400).json({ error: "Template name must be 3-100 characters" });
      }
      updates.template_name = template_name;
    }

    if (template_subject) {
      if (!validateString(template_subject, 3, 200)) {
        return res.status(400).json({ error: "Template subject must be 3-200 characters" });
      }
      updates.template_subject = template_subject;
    }

    if (template_body !== undefined) {
      updates.template_body = template_body;
    }

    if (template_html !== undefined) {
      updates.template_html = template_html;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    // Build update query
    const updateFields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(", ");
    const updateValues = Object.values(updates);

    await db.query(`UPDATE email_templates SET ${updateFields}, updated_at = NOW() WHERE id = ?`, [...updateValues, id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'template_updated', 'email_template', ?, ?, ?, ?, NOW())`,
      [userId, id, JSON.stringify(updates), req.ip, req.get("user-agent")]
    );

    res.json({
      success: true,
      data: {
        template_id: id,
        updated_fields: Object.keys(updates),
      },
    });
  } catch (error) {
    console.error("Update email template error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Delete email template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get template
    const templateResult = await db.query(`SELECT * FROM email_templates WHERE id = ?`, [id]);

    if (templateResult.length === 0) {
      return res.status(404).json({ error: "Email template not found" });
    }

    // Delete template
    await db.query(`DELETE FROM email_templates WHERE id = ?`, [id]);

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'template_deleted', 'email_template', ?, ?, ?, ?, NOW())`,
      [userId, id, JSON.stringify({ deleted_template: templateResult[0].template_name }), req.ip, req.get("user-agent")]
    );

    res.json({
      success: true,
      data: {
        template_id: id,
        message: "Email template deleted successfully",
      },
    });
  } catch (error) {
    console.error("Delete email template error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== EMAIL HISTORY ====================

/**
 * Get email history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, recipient_email } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];

    if (status) {
      whereClause += " AND email_status = ?";
      params.push(status);
    }

    if (recipient_email) {
      whereClause += " AND recipient_email LIKE ?";
      params.push(`%${recipient_email}%`);
    }

    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as total FROM email_logs ${whereClause}`, params);
    const total = countResult[0].total;

    // Get emails
    const emails = await db.query(
      `SELECT * FROM email_logs ${whereClause} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get email history error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

/**
 * Get email details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await db.query(`SELECT * FROM email_logs WHERE id = ?`, [id]);

    if (email.length === 0) {
      return res.status(404).json({ error: "Email log not found" });
    }

    res.json({
      success: true,
      data: email[0],
    });
  } catch (error) {
    console.error("Get email details error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== EMAIL VERIFICATION ====================

/**
 * Verify email address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { email_address } = req.body;

    if (!validateEmail(email_address)) {
      return res.status(400).json({ error: "Invalid email address format" });
    }

    // Basic verification - in production, use email verification service
    const isValid = validateEmail(email_address);

    res.json({
      success: true,
      data: {
        email_address,
        is_valid: isValid,
        verified_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== EMAIL STATISTICS ====================

/**
 * Get email statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateWhereClause = "";
    const dateParams = [];

    if (start_date) {
      dateWhereClause += " AND sent_at >= ?";
      dateParams.push(start_date);
    }

    if (end_date) {
      dateWhereClause += " AND sent_at <= ?";
      dateParams.push(end_date);
    }

    // Overall stats
    const overallStats = await db.query(
      `SELECT 
        COUNT(*) as total_emails,
        SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM email_logs
      WHERE 1=1 ${dateWhereClause}`,
      dateParams
    );

    // Success rate
    const successRate = overallStats[0].total_emails > 0
      ? ((overallStats[0].sent_count / overallStats[0].total_emails) * 100).toFixed(2)
      : 0;

    // Email counts by status
    const statusStats = await db.query(
      `SELECT 
        email_status,
        COUNT(*) as count
      FROM email_logs
      WHERE 1=1 ${dateWhereClause}
      GROUP BY email_status`,
      dateParams
    );

    res.json({
      success: true,
      data: {
        overall: {
          ...overallStats[0],
          success_rate: parseFloat(successRate),
        },
        by_status: statusStats,
      },
    });
  } catch (error) {
    console.error("Get email stats error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

// ==================== EMAIL RESEND ====================

/**
 * Resend failed email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resendEmail = async (req, res) => {
  try {
    const { email_log_id } = req.params;
    const userId = req.user.id;

    // Get original email log
    const emailResult = await db.query(`SELECT * FROM email_logs WHERE id = ?`, [email_log_id]);

    if (emailResult.length === 0) {
      return res.status(404).json({ error: "Email log not found" });
    }

    const originalEmail = emailResult[0];

    // Resend email (note: original subject and body are not stored, so we send notification)
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: originalEmail.recipient_email,
      subject: originalEmail.subject,
      text: "Email retry sent",
      html: "<p>This is a retry of a previously failed email.</p>",
    };

    let emailStatus = "sent";
    let sendError = null;

    try {
      await emailTransporter.sendMail(mailOptions);
    } catch (err) {
      emailStatus = "failed";
      sendError = err.message;
    }

    // Create new email log for resend
    const result = await db.query(
      `INSERT INTO email_logs (user_id, recipient_email, subject, email_status, send_error, sent_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, originalEmail.recipient_email, originalEmail.subject, emailStatus, sendError]
    );

    // Log to audit
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, 'email_resent', 'email', ?, ?, ?, ?, NOW())`,
      [userId, result.insertId, JSON.stringify({ original_email_id: email_log_id, status: emailStatus }), req.ip, req.get("user-agent")]
    );

    res.status(201).json({
      success: true,
      data: {
        new_email_log_id: result.insertId,
        original_email_log_id: email_log_id,
        recipient_email: originalEmail.recipient_email,
        status: emailStatus,
        error: sendError,
      },
    });
  } catch (error) {
    console.error("Resend email error:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
};

module.exports = exports;
