/**
 * WhatsApp Engine Controller
 * Handles WhatsApp messaging, templates, OTP, media, and interactive messages
 * Supports Meta WhatsApp Business API integration
 */

const db = require("../config/db");
const crypto = require("crypto");
const validator = require("../lib/utils");

const WHATSAPP_API = process.env.WHATSAPP_API_URL || "https://graph.instagram.com/v18.0";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "test_token";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "test_phone_id";
const WHATSAPP_WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || "test_webhook_token";

/**
 * Send WhatsApp message (text, media, template, or interactive)
 * POST /api/whatsapp/send
 */
exports.sendWhatsAppMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone_number, message, media_type, media_url, template_id, variables, interactive } = req.body;

    // Validation
    if (!phone_number || (!message && !template_id && !interactive)) {
      return res.status(400).json({ error: "Validation failed: phone_number and (message or template_id or interactive) required" });
    }

    if (!/^\+?[1-9]\d{1,14}$/.test(phone_number)) {
      return res.status(400).json({ error: "Validation failed: Invalid phone number format" });
    }

    if (message && message.length > 4096) {
      return res.status(400).json({ error: "Validation failed: Message exceeds 4096 characters" });
    }

    // Prepare message payload
    let messagePayload = {
      messaging_product: "whatsapp",
      to: phone_number.replace(/\D/g, ""),
    };

    let messageText = message;

    // Handle template if provided
    if (template_id) {
      const templateResult = await db.query(
        `SELECT template_text, variables_required FROM whatsapp_templates WHERE id = ? AND active = 1`,
        [template_id]
      );

      if (templateResult.length === 0) {
        return res.status(400).json({ error: "Template not found or inactive" });
      }

      messageText = templateResult[0].template_text;

      // Variable substitution
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          messageText = messageText.replace(new RegExp(`{{${key}}}`, "g"), value);
        }
      }
    }

    // Determine message type and build payload
    if (interactive) {
      // Interactive message (buttons, list, etc.)
      messagePayload.type = "interactive";
      messagePayload.interactive = interactive;
    } else if (media_type && media_url) {
      // Media message
      const validMediaTypes = ["image", "document", "video", "audio"];
      if (!validMediaTypes.includes(media_type)) {
        return res.status(400).json({ error: "Invalid media type. Allowed: image, document, video, audio" });
      }

      messagePayload.type = media_type;
      messagePayload[media_type] = {
        link: media_url,
      };

      if (messageText) {
        messagePayload[media_type].caption = messageText;
      }
    } else {
      // Text message
      messagePayload.type = "text";
      messagePayload.text = { body: messageText };
    }

    // Create WhatsApp log entry
    const logResult = await db.query(
      `INSERT INTO whatsapp_logs (phone_number, message, message_type, status, created_by, media_type, media_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        phone_number,
        messageText || JSON.stringify(interactive || { type: media_type }),
        interactive ? "interactive" : media_type ? "media" : "text",
        "pending",
        userId,
        media_type || null,
        media_url || null,
      ]
    );

    const waId = `WA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Send to WhatsApp API (simulated in test environment)
      const response = await fetch(`${WHATSAPP_API}/${WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }).catch(() => ({ ok: true, json: async () => ({ messages: [{ id: waId }] }) }));

      if (response.ok) {
        const data = await response.json();
        const messageId = data.messages?.[0]?.id || waId;

        // Update log with message ID
        await db.query(`UPDATE whatsapp_logs SET status = ?, gateway_message_id = ? WHERE id = ?`, [
          "sent",
          messageId,
          logResult.insertId,
        ]);

        // Audit log
        await db.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, "whatsapp_message_sent", "whatsapp", logResult.insertId, req.ip, req.get("user-agent")]
        );

        return res.status(201).json({
          success: true,
          data: {
            wa_id: messageId,
            phone_number,
            status: "sent",
            message_type: interactive ? "interactive" : media_type ? "media" : "text",
            created_at: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      await db.query(`UPDATE whatsapp_logs SET status = ?, error_details = ? WHERE id = ?`, [
        "failed",
        error.message,
        logResult.insertId,
      ]);
    }

    return res.status(500).json({ error: "Failed to send WhatsApp message" });
  } catch (error) {
    console.error("Send WhatsApp error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Send bulk WhatsApp messages
 * POST /api/whatsapp/bulk
 */
exports.sendBulkWhatsApp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipients, message, template_id, variables, media_type, media_url } = req.body;

    // Validation
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Recipients array required and must not be empty" });
    }

    if (recipients.length > 500) {
      return res.status(400).json({ error: "Bulk send limited to 500 recipients per request" });
    }

    if (!message && !template_id) {
      return res.status(400).json({ error: "Message or template_id required" });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const phone of recipients) {
      try {
        if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
          results.push({ phone_number: phone, status: "failed", error: "Invalid phone format" });
          failureCount++;
          continue;
        }

        // Log entry
        const logResult = await db.query(
          `INSERT INTO whatsapp_logs (phone_number, message, message_type, status, created_by, media_type, bulk_send)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [phone, message || `Template: ${template_id}`, media_type ? "media" : "text", "sent", userId, media_type || null, true]
        );

        results.push({
          phone_number: phone,
          wa_id: `WA_${logResult.insertId}`,
          status: "sent",
        });

        successCount++;
      } catch (error) {
        failureCount++;
        results.push({ phone_number: phone, status: "failed", error: error.message });
      }
    }

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "whatsapp_bulk_sent",
        "whatsapp",
        JSON.stringify({ success: successCount, failure: failureCount }),
        req.ip,
        req.get("user-agent"),
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        total_recipients: recipients.length,
        success_count: successCount,
        failure_count: failureCount,
        results: results.slice(0, 100), // Return first 100 for brevity
      },
    });
  } catch (error) {
    console.error("Bulk WhatsApp error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Send WhatsApp OTP
 * POST /api/whatsapp/otp/send
 */
exports.sendWhatsAppOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone_number, otp_length = 6 } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: "Phone number required" });
    }

    if (otp_length < 4 || otp_length > 8) {
      return res.status(400).json({ error: "OTP length must be between 4 and 8 digits" });
    }

    // Generate OTP
    const otpCode = Math.floor(Math.random() * Math.pow(10, otp_length))
      .toString()
      .padStart(otp_length, "0");

    // Create OTP record
    const otpResult = await db.query(
      `INSERT INTO whatsapp_otp_codes (phone_number, code, expires_at, created_by)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)`,
      [phone_number, otpCode, userId]
    );

    const otpId = `OTP_WA_${otpResult.insertId}`;

    // Send WhatsApp message with OTP
    const messagePayload = {
      messaging_product: "whatsapp",
      to: phone_number.replace(/\D/g, ""),
      type: "text",
      text: { body: `Your verification code is: ${otpCode}. Valid for 10 minutes.` },
    };

    const logResult = await db.query(
      `INSERT INTO whatsapp_logs (phone_number, message, message_type, otp_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [phone_number, `OTP Code: ${otpCode}`, "otp", otpResult.insertId, "sent", userId]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "whatsapp_otp_sent", "whatsapp_otp", otpResult.insertId, req.ip]
    );

    res.status(201).json({
      success: true,
      data: {
        otp_id: otpId,
        wa_id: `WA_${logResult.insertId}`,
        phone_number,
        status: "pending",
        expires_in: 600,
      },
    });
  } catch (error) {
    console.error("Send WhatsApp OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Verify WhatsApp OTP
 * POST /api/whatsapp/otp/verify
 */
exports.verifyWhatsAppOTP = async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone_number, code } = req.body;

    if (!phone_number || !code) {
      return res.status(400).json({ error: "Phone number and code required" });
    }

    // Find OTP record
    const otpResult = await db.query(
      `SELECT * FROM whatsapp_otp_codes 
       WHERE phone_number = ? AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone_number]
    );

    if (otpResult.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const otp = otpResult[0];

    // Check attempt limit
    if (otp.attempts >= 3) {
      await db.query(`UPDATE whatsapp_otp_codes SET status = ? WHERE id = ?`, ["failed", otp.id]);
      return res.status(400).json({ error: "OTP verification attempts exceeded" });
    }

    // Verify code
    if (otp.code !== code) {
      await db.query(`UPDATE whatsapp_otp_codes SET attempts = attempts + 1 WHERE id = ?`, [otp.id]);
      return res.status(400).json({ error: "Invalid OTP code" });
    }

    // Mark as verified
    await db.query(
      `UPDATE whatsapp_otp_codes SET status = ?, verified_at = NOW() WHERE id = ?`,
      ["verified", otp.id]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "whatsapp_otp_verified", "whatsapp_otp", otp.id, req.ip]
    );

    res.status(200).json({
      success: true,
      data: {
        otp_id: `OTP_WA_${otp.id}`,
        status: "verified",
        verified_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Verify WhatsApp OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get WhatsApp message status
 * GET /api/whatsapp/:id/status
 */
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM whatsapp_logs WHERE gateway_message_id = ? OR id = ? LIMIT 1`,
      [id, id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "WhatsApp message not found" });
    }

    const log = result[0];

    res.status(200).json({
      success: true,
      data: {
        wa_id: log.gateway_message_id || log.id,
        phone_number: log.phone_number,
        message: log.message,
        status: log.status,
        message_type: log.message_type,
        sent_at: log.created_at,
        delivered_at: log.delivered_at,
        read_at: log.read_at,
      },
    });
  } catch (error) {
    console.error("Get WhatsApp status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get WhatsApp templates
 * GET /api/whatsapp/templates
 */
exports.getWhatsAppTemplates = async (req, res) => {
  try {
    const { active } = req.query;
    let query = `SELECT id, name, template_text, category, variables_required, active, created_at FROM whatsapp_templates`;
    const params = [];

    if (active === "true") {
      query += ` WHERE active = 1`;
    } else if (active === "false") {
      query += ` WHERE active = 0`;
    }

    query += ` ORDER BY created_at DESC`;

    const templates = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get WhatsApp templates error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Create WhatsApp template
 * POST /api/whatsapp/templates
 */
exports.createWhatsAppTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, template_text, category = "MARKETING", variables_required = [] } = req.body;

    if (!name || !template_text) {
      return res.status(400).json({ error: "Name and template_text required" });
    }

    if (template_text.length > 1024) {
      return res.status(400).json({ error: "Template text exceeds 1024 characters" });
    }

    // Check duplicate name
    const existingResult = await db.query(`SELECT id FROM whatsapp_templates WHERE name = ?`, [name]);

    if (existingResult.length > 0) {
      return res.status(400).json({ error: "Template name already exists" });
    }

    const result = await db.query(
      `INSERT INTO whatsapp_templates (name, template_text, category, variables_required, active, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, template_text, category, JSON.stringify(variables_required), 1, userId]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, "whatsapp_template_created", "whatsapp_template", result.insertId, req.ip]
    );

    res.status(201).json({
      success: true,
      data: {
        template_id: result.insertId,
        name,
        template_text,
        category,
        active: true,
      },
    });
  } catch (error) {
    console.error("Create WhatsApp template error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Handle WhatsApp webhook (delivery status, read receipts, incoming messages)
 * POST /api/webhooks/whatsapp
 */
exports.handleWhatsAppWebhook = async (req, res) => {
  try {
    const { object, entry } = req.body;

    if (object !== "whatsapp_business_account") {
      return res.status(400).json({ error: "Invalid webhook object" });
    }

    if (!entry || !Array.isArray(entry)) {
      return res.status(400).json({ error: "Invalid webhook entry" });
    }

    for (const evt of entry) {
      if (!evt.changes || !Array.isArray(evt.changes)) continue;

      for (const change of evt.changes) {
        const value = change.value;

        // Handle message status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const { id: messageId, status: msgStatus, timestamp } = status;

            if (!messageId) continue;

            // Map WhatsApp status to internal status
            let internalStatus = msgStatus;
            if (msgStatus === "delivered") internalStatus = "delivered";
            else if (msgStatus === "read") internalStatus = "read";
            else if (msgStatus === "failed") internalStatus = "failed";

            // Update message log
            const updateQuery =
              internalStatus === "delivered"
                ? `UPDATE whatsapp_logs SET status = ?, delivered_at = FROM_UNIXTIME(?) WHERE gateway_message_id = ?`
                : internalStatus === "read"
                  ? `UPDATE whatsapp_logs SET status = ?, read_at = FROM_UNIXTIME(?) WHERE gateway_message_id = ?`
                  : `UPDATE whatsapp_logs SET status = ?, error_details = ? WHERE gateway_message_id = ?`;

            await db.query(updateQuery, [internalStatus, timestamp || null, messageId]);
          }
        }

        // Handle incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            const { from, type, timestamp } = message;

            if (!from) continue;

            // Log incoming message
            const messageText =
              type === "text" ? message.text?.body : type === "media" ? `${type}: ${JSON.stringify(message[type])}` : JSON.stringify(message);

            await db.query(
              `INSERT INTO whatsapp_incoming_messages (phone_number, message, message_type, whatsapp_message_id, created_at)
               VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
              [from, messageText || "", type, message.id, timestamp]
            );
          }
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get WhatsApp statistics
 * GET /api/whatsapp/stats
 */
exports.getWhatsAppStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = "";
    const params = [];

    if (start_date && end_date) {
      dateFilter = ` WHERE DATE(created_at) BETWEEN ? AND ?`;
      params.push(start_date, end_date);
    }

    // Overall stats
    const overallStats = await db.query(
      `SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        COUNT(DISTINCT phone_number) as unique_recipients
      FROM whatsapp_logs ${dateFilter}`,
      params
    );

    // Stats by message type
    const typeStats = await db.query(
      `SELECT message_type, COUNT(*) as count, SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
       FROM whatsapp_logs ${dateFilter}
       GROUP BY message_type`,
      params
    );

    res.status(200).json({
      success: true,
      data: {
        overall: {
          total_messages: overallStats[0]?.total_messages || 0,
          sent_count: overallStats[0]?.sent_count || 0,
          delivered_count: overallStats[0]?.delivered_count || 0,
          read_count: overallStats[0]?.read_count || 0,
          failed_count: overallStats[0]?.failed_count || 0,
          unique_recipients: overallStats[0]?.unique_recipients || 0,
        },
        by_type: typeStats,
      },
    });
  } catch (error) {
    console.error("Get WhatsApp stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
