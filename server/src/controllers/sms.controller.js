/**
 * SMS Engine Controller
 * Handles SMS sending via Africa's Talking and Twilio with delivery tracking
 */

const db = require("../config/db");
const crypto = require("crypto");
const axios = require("axios");
const { z } = require("zod");

// Africa's Talking SDK (if installed)
let AfricasTalking;
try {
  AfricasTalking = require("africastalking");
} catch (e) {
  // SDK not installed, will use HTTP API
}

// Twilio SDK (if installed)
let TwilioClient;
try {
  TwilioClient = require("twilio");
} catch (e) {
  // SDK not installed, will use HTTP API
}

/**
 * Generate unique SMS ID
 */
function generateSmsId() {
  return "SMS_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Log SMS audit
 */
async function logSmsAudit(userId, action, smsId, details, req) {
  try {
    const ip = req?.ip || req?.connection?.remoteAddress || "unknown";
    const userAgent = req?.get?.("user-agent") || "unknown";

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, action, "sms", smsId, JSON.stringify(details || {}), ip, userAgent]
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}

/**
 * Verify Africa's Talking webhook signature
 */
function verifyAfricasTalkingSignature(body, signature) {
  const apiKey = process.env.AFRICASTALKING_API_KEY || "";
  const hash = crypto
    .createHmac("sha256", apiKey)
    .update(JSON.stringify(body))
    .digest("base64");
  return hash === signature;
}

/**
 * Verify Twilio webhook signature
 */
function verifyTwilioSignature(url, params, signature) {
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  let data = url;
  const keys = Object.keys(params).sort();
  for (const key of keys) {
    data += key + params[key];
  }
  const hash = crypto
    .createHmac("sha1", authToken)
    .update(data)
    .digest("base64");
  return hash === signature;
}

// Validation schemas
const sendSmsSchema = z.object({
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  message: z.string().min(1).max(1600),
  gateway: z.enum(["africastalking", "twilio"]).optional(),
  template_id: z.string().optional(),
  variables: z.record(z.string()).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

const sendBulkSmsSchema = z.object({
  recipients: z
    .array(z.string().regex(/^\+?[1-9]\d{1,14}$/))
    .min(1)
    .max(1000),
  message: z.string().min(1).max(1600),
  gateway: z.enum(["africastalking", "twilio"]).optional(),
  template_id: z.string().optional(),
  variables: z.record(z.string()).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

const sendOtpSchema = z.object({
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  otp_length: z.number().min(4).max(8).optional(),
  gateway: z.enum(["africastalking", "twilio"]).optional(),
});

/**
 * Send SMS via Africa's Talking
 */
async function sendViaAfricasTalking(phoneNumber, message, userId) {
  try {
    const response = await axios.post(
      "https://api.sandbox.africastalking.com/version1/messaging",
      {
        username: process.env.AFRICASTALKING_USERNAME || "sandbox",
        APIkey: process.env.AFRICASTALKING_API_KEY || "",
        recipients: [phoneNumber],
        message,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return {
      success: true,
      gateway: "africastalking",
      reference: response.data?.SMSMessageData?.Messages?.[0]?.id,
      cost: response.data?.SMSMessageData?.Messages?.[0]?.cost,
    };
  } catch (error) {
    console.error("Africa's Talking error:", error);
    return {
      success: false,
      gateway: "africastalking",
      error: error.message,
    };
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(phoneNumber, message, userId) {
  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        From: process.env.TWILIO_PHONE_NUMBER || "+1234567890",
        To: phoneNumber,
        Body: message,
      },
      {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID || "",
          password: process.env.TWILIO_AUTH_TOKEN || "",
        },
      }
    );

    return {
      success: true,
      gateway: "twilio",
      reference: response.data?.sid,
      cost: response.data?.price,
    };
  } catch (error) {
    console.error("Twilio error:", error);
    return {
      success: false,
      gateway: "twilio",
      error: error.message,
    };
  }
}

/**
 * Get SMS template and replace variables
 */
async function getSmsTemplate(templateId, variables = {}) {
  try {
    const result = await db.query(`SELECT * FROM sms_templates WHERE id = ? AND active = 1`, [templateId]);

    if (result.length === 0) {
      return { success: false, error: "Template not found" };
    }

    let message = result[0].template_text;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return { success: true, message, template_name: result[0].name };
  } catch (error) {
    console.error("Template error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send single SMS
 * POST /api/sms/send
 */
async function sendSms(req, res, next) {
  try {
    const validationResult = sendSmsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { phone_number, message: msgText, gateway, template_id, variables, priority } = validationResult.data;
    const userId = req.user.id;
    const defaultGateway = process.env.DEFAULT_SMS_GATEWAY || "africastalking";
    const selectedGateway = gateway || defaultGateway;

    // Generate SMS ID
    const smsId = generateSmsId();

    // Get template if provided
    let finalMessage = msgText;
    if (template_id) {
      const templateResult = await getSmsTemplate(template_id, variables);
      if (!templateResult.success) {
        return res.status(400).json({
          success: false,
          error: "Template error",
          details: templateResult.error,
        });
      }
      finalMessage = templateResult.message;
    }

    // Check message length (SMS limits)
    if (finalMessage.length > 1600) {
      return res.status(400).json({
        success: false,
        error: "Message exceeds maximum length of 1600 characters",
      });
    }

    // Record SMS in database
    await db.query(
      `INSERT INTO sms_logs (sms_id, phone_number, message, gateway, status, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [smsId, phone_number, finalMessage, selectedGateway, "pending", priority || "normal", userId]
    );

    // Send SMS via selected gateway
    let sendResult;
    if (selectedGateway === "twilio") {
      sendResult = await sendViaTwilio(phone_number, finalMessage, userId);
    } else {
      sendResult = await sendViaAfricasTalking(phone_number, finalMessage, userId);
    }

    if (sendResult.success) {
      // Update SMS log with gateway reference
      await db.query(
        `UPDATE sms_logs SET status = ?, gateway_reference = ?, gateway_response = ?, updated_at = NOW() WHERE sms_id = ?`,
        [
          "sent",
          sendResult.reference || null,
          JSON.stringify({
            cost: sendResult.cost,
            sent_at: new Date().toISOString(),
          }),
          smsId,
        ]
      );

      // Log audit
      await logSmsAudit(userId, "sms_sent", smsId, { phone_number, gateway: selectedGateway }, req);

      res.status(201).json({
        success: true,
        message: "SMS sent successfully",
        data: {
          sms_id: smsId,
          phone_number,
          gateway: selectedGateway,
          status: "sent",
          reference: sendResult.reference,
        },
      });
    } else {
      // Update SMS log with error
      await db.query(
        `UPDATE sms_logs SET status = ?, gateway_response = ?, updated_at = NOW() WHERE sms_id = ?`,
        [
          "failed",
          JSON.stringify({
            error: sendResult.error,
            failed_at: new Date().toISOString(),
          }),
          smsId,
        ]
      );

      res.status(500).json({
        success: false,
        error: "Failed to send SMS",
        details: sendResult.error,
        sms_id: smsId,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Send bulk SMS
 * POST /api/sms/bulk
 */
async function sendBulkSms(req, res, next) {
  try {
    const validationResult = sendBulkSmsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { recipients, message: msgText, gateway, template_id, variables, priority } = validationResult.data;
    const userId = req.user.id;
    const defaultGateway = process.env.DEFAULT_SMS_GATEWAY || "africastalking";
    const selectedGateway = gateway || defaultGateway;

    // Get template if provided
    let finalMessage = msgText;
    if (template_id) {
      const templateResult = await getSmsTemplate(template_id, variables);
      if (!templateResult.success) {
        return res.status(400).json({
          success: false,
          error: "Template error",
          details: templateResult.error,
        });
      }
      finalMessage = templateResult.message;
    }

    // Generate bulk SMS ID
    const bulkSmsId = generateSmsId() + "_BULK";
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send to each recipient
    for (const phoneNumber of recipients) {
      const smsId = generateSmsId();

      // Record SMS
      await db.query(
        `INSERT INTO sms_logs (sms_id, phone_number, message, gateway, status, priority, bulk_sms_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [smsId, phoneNumber, finalMessage, selectedGateway, "pending", priority || "normal", bulkSmsId, userId]
      );

      // Send SMS
      let sendResult;
      if (selectedGateway === "twilio") {
        sendResult = await sendViaTwilio(phoneNumber, finalMessage, userId);
      } else {
        sendResult = await sendViaAfricasTalking(phoneNumber, finalMessage, userId);
      }

      if (sendResult.success) {
        await db.query(
          `UPDATE sms_logs SET status = ?, gateway_reference = ?, updated_at = NOW() WHERE sms_id = ?`,
          ["sent", sendResult.reference || null, smsId]
        );
        successCount++;
        results.push({
          phone_number: phoneNumber,
          sms_id: smsId,
          status: "sent",
          reference: sendResult.reference,
        });
      } else {
        await db.query(
          `UPDATE sms_logs SET status = ?, gateway_response = ?, updated_at = NOW() WHERE sms_id = ?`,
          [
            "failed",
            JSON.stringify({
              error: sendResult.error,
            }),
            smsId,
          ]
        );
        failureCount++;
        results.push({
          phone_number: phoneNumber,
          sms_id: smsId,
          status: "failed",
          error: sendResult.error,
        });
      }
    }

    // Log audit
    await logSmsAudit(userId, "bulk_sms_sent", bulkSmsId, { count: recipients.length, success: successCount }, req);

    res.status(201).json({
      success: true,
      message: "Bulk SMS sent",
      data: {
        bulk_sms_id: bulkSmsId,
        total_recipients: recipients.length,
        success_count: successCount,
        failure_count: failureCount,
        results,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send OTP
 * POST /api/sms/otp/send
 */
async function sendOtp(req, res, next) {
  try {
    const validationResult = sendOtpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { phone_number, otp_length, gateway } = validationResult.data;
    const userId = req.user.id;
    const defaultGateway = process.env.DEFAULT_SMS_GATEWAY || "africastalking";
    const selectedGateway = gateway || defaultGateway;

    // Generate OTP
    const otpCode = Math.floor(Math.pow(10, (otp_length || 6) - 1) + Math.random() * 9 * Math.pow(10, (otp_length || 6) - 1))
      .toString()
      .substring(0, otp_length || 6);

    // Create OTP record
    const otpResult = await db.query(
      `INSERT INTO otp_codes (phone_number, code, expires_at, attempts, created_by)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, ?)`,
      [phone_number, otpCode, userId]
    );

    const otpId = otpResult.insertId;

    // Generate SMS ID
    const smsId = generateSmsId();

    // Prepare OTP message
    const otpMessage = `Your OTP is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

    // Record SMS
    await db.query(
      `INSERT INTO sms_logs (sms_id, phone_number, message, gateway, status, priority, otp_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [smsId, phone_number, otpMessage, selectedGateway, "pending", "high", otpId, userId]
    );

    // Send SMS
    let sendResult;
    if (selectedGateway === "twilio") {
      sendResult = await sendViaTwilio(phone_number, otpMessage, userId);
    } else {
      sendResult = await sendViaAfricasTalking(phone_number, otpMessage, userId);
    }

    if (sendResult.success) {
      await db.query(
        `UPDATE sms_logs SET status = ?, gateway_reference = ?, updated_at = NOW() WHERE sms_id = ?`,
        ["sent", sendResult.reference || null, smsId]
      );

      // Log audit
      await logSmsAudit(userId, "otp_sent", smsId, { phone_number, gateway: selectedGateway }, req);

      res.status(201).json({
        success: true,
        message: "OTP sent successfully",
        data: {
          sms_id: smsId,
          otp_id: otpId,
          phone_number,
          expires_in: "10 minutes",
          status: "sent",
        },
      });
    } else {
      await db.query(`DELETE FROM otp_codes WHERE id = ?`, [otpId]);
      await db.query(
        `UPDATE sms_logs SET status = ?, updated_at = NOW() WHERE sms_id = ?`,
        ["failed", smsId]
      );

      res.status(500).json({
        success: false,
        error: "Failed to send OTP",
        details: sendResult.error,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Verify OTP
 * POST /api/sms/otp/verify
 */
async function verifyOtp(req, res, next) {
  try {
    const { phone_number, code } = req.body;

    if (!phone_number || !code) {
      return res.status(400).json({
        success: false,
        error: "Phone number and code are required",
      });
    }

    // Find OTP
    const otpResult = await db.query(
      `SELECT * FROM otp_codes 
       WHERE phone_number = ? AND code = ? AND expires_at > NOW() AND verified = 0
       ORDER BY created_at DESC LIMIT 1`,
      [phone_number, code]
    );

    if (otpResult.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired OTP",
      });
    }

    const otp = otpResult[0];

    // Check attempts
    if (otp.attempts >= 3) {
      // Mark as failed
      await db.query(`UPDATE otp_codes SET verified = 2 WHERE id = ?`, [otp.id]);

      return res.status(400).json({
        success: false,
        error: "Maximum verification attempts exceeded",
      });
    }

    // Mark as verified
    await db.query(
      `UPDATE otp_codes SET verified = 1, verified_at = NOW(), attempts = attempts + 1 WHERE id = ?`,
      [otp.id]
    );

    // Log audit
    await logSmsAudit(req.user.id, "otp_verified", null, { phone_number }, req);

    res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        otp_id: otp.id,
        phone_number,
        verified_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Africa's Talking webhook handler
 */
async function handleAfricasTalkingWebhook(req, res, next) {
  try {
    const { MessageID, Status, PhoneNumber, Timestamp, StatusCode } = req.body;

    if (!MessageID) {
      return res.status(400).json({ success: false, error: "Invalid webhook data" });
    }

    // Find SMS log by gateway reference
    const smsResult = await db.query(
      `SELECT * FROM sms_logs WHERE gateway_reference = ? AND gateway = 'africastalking'`,
      [MessageID]
    );

    if (smsResult.length === 0) {
      console.warn("SMS not found for Africa's Talking webhook:", MessageID);
      return res.json({ success: true }); // Acknowledge to Africa's Talking
    }

    const sms = smsResult[0];

    // Map Africa's Talking status to our status
    let newStatus = "sent";
    if (Status === "Success") {
      newStatus = "delivered";
    } else if (Status === "Failed") {
      newStatus = "failed";
    } else if (Status === "Queued") {
      newStatus = "sent";
    }

    // Update SMS log
    await db.query(
      `UPDATE sms_logs SET status = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
      [
        newStatus,
        JSON.stringify({
          status_code: StatusCode,
          timestamp: Timestamp,
          status: Status,
        }),
        sms.id,
      ]
    );

    // Log audit
    await logSmsAudit(null, `sms_${newStatus}_africastalking`, sms.sms_id, { status: Status }, req);

    console.log(`Africa's Talking SMS ${MessageID}: ${Status}`);

    res.json({ success: true });
  } catch (error) {
    console.error("Africa's Talking webhook error:", error);
    res.json({ success: false });
  }
}

/**
 * Twilio webhook handler
 */
async function handleTwilioWebhook(req, res, next) {
  try {
    const { MessageSid, MessageStatus, To } = req.body;

    if (!MessageSid) {
      return res.status(400).json({ success: false, error: "Invalid webhook data" });
    }

    // Find SMS log by gateway reference
    const smsResult = await db.query(
      `SELECT * FROM sms_logs WHERE gateway_reference = ? AND gateway = 'twilio'`,
      [MessageSid]
    );

    if (smsResult.length === 0) {
      console.warn("SMS not found for Twilio webhook:", MessageSid);
      return res.json({ success: true }); // Acknowledge to Twilio
    }

    const sms = smsResult[0];

    // Map Twilio status to our status
    let newStatus = "sent";
    if (MessageStatus === "delivered") {
      newStatus = "delivered";
    } else if (MessageStatus === "failed" || MessageStatus === "undelivered") {
      newStatus = "failed";
    }

    // Update SMS log
    await db.query(
      `UPDATE sms_logs SET status = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
      [
        newStatus,
        JSON.stringify({
          message_status: MessageStatus,
          timestamp: new Date().toISOString(),
        }),
        sms.id,
      ]
    );

    // Log audit
    await logSmsAudit(null, `sms_${newStatus}_twilio`, sms.sms_id, { status: MessageStatus }, req);

    console.log(`Twilio SMS ${MessageSid}: ${MessageStatus}`);

    res.json({ success: true });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    res.json({ success: false });
  }
}

/**
 * Get SMS status
 * GET /api/sms/:id/status
 */
async function getSmsStatus(req, res, next) {
  try {
    const { id } = req.params;

    const smsResult = await db.query(`SELECT * FROM sms_logs WHERE sms_id = ?`, [id]);

    if (smsResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "SMS not found",
      });
    }

    const sms = smsResult[0];

    // Log access
    await logSmsAudit(req.user.id, "sms_status_accessed", id, {}, req);

    res.json({
      success: true,
      data: {
        sms_id: sms.sms_id,
        phone_number: sms.phone_number,
        status: sms.status,
        gateway: sms.gateway,
        message_length: sms.message.length,
        created_at: sms.created_at,
        updated_at: sms.updated_at,
        gateway_reference: sms.gateway_reference,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get SMS templates
 * GET /api/sms/templates
 */
async function getSmsTemplates(req, res, next) {
  try {
    const { active } = req.query;

    let query = `SELECT * FROM sms_templates WHERE 1=1`;
    const params = [];

    if (active === "true" || active === "1") {
      query += ` AND active = 1`;
    } else if (active === "false" || active === "0") {
      query += ` AND active = 0`;
    }

    query += ` ORDER BY created_at DESC`;

    const templates = await db.query(query, params);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create SMS template
 * POST /api/sms/templates
 */
async function createSmsTemplate(req, res, next) {
  try {
    const { name, template_text, description } = req.body;
    const userId = req.user.id;

    if (!name || !template_text) {
      return res.status(400).json({
        success: false,
        error: "Name and template text are required",
      });
    }

    const result = await db.query(
      `INSERT INTO sms_templates (name, template_text, description, active, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [name, template_text, description || null, 1, userId]
    );

    // Log audit
    await logSmsAudit(userId, "template_created", null, { name }, req);

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: {
        template_id: result.insertId,
        name,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get SMS statistics
 * GET /api/sms/stats
 */
async function getSmsStats(req, res, next) {
  try {
    const { start_date, end_date, gateway } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_sms,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        COUNT(DISTINCT phone_number) as unique_recipients
      FROM sms_logs
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(new Date(end_date));
    }

    if (gateway) {
      query += ` AND gateway = ?`;
      params.push(gateway);
    }

    const stats = await db.query(query, params);

    // Gateway breakdown
    const gatewayQuery = `
      SELECT 
        gateway,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
      FROM sms_logs
      WHERE 1=1
    `;
    const gatewayParams = [];

    if (start_date) {
      gatewayQuery += ` AND created_at >= ?`;
      gatewayParams.push(new Date(start_date));
    }

    if (end_date) {
      gatewayQuery += ` AND created_at <= ?`;
      gatewayParams.push(new Date(end_date));
    }

    gatewayQuery += ` GROUP BY gateway`;

    const gatewayStats = await db.query(gatewayQuery, gatewayParams);

    // Log access
    await logSmsAudit(req.user.id, "sms_stats_accessed", null, {}, req);

    res.json({
      success: true,
      data: {
        overall: stats[0],
        by_gateway: gatewayStats,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendSms,
  sendBulkSms,
  sendOtp,
  verifyOtp,
  handleAfricasTalkingWebhook,
  handleTwilioWebhook,
  getSmsStatus,
  getSmsTemplates,
  createSmsTemplate,
  getSmsStats,
};
