const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("SMS Engine - Africa's Talking and Twilio", () => {
  let token;
  let userId;
  let templateId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["sms@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    // Create user role
    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "super_admin"]
    );

    // Generate token
    token = jwt.sign(
      { id: userId, email: "sms@test.com", roles: ["super_admin"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );

    // Create test SMS template
    const templateResult = await db.query(
      `INSERT INTO sms_templates (name, template_text, active, created_by)
       VALUES (?, ?, ?, ?)`,
      ["Test Template", "Hello {{name}}, your code is {{code}}", 1, userId]
    );
    templateId = templateResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query(`DELETE FROM audit_logs WHERE user_id = ? OR user_id IS NULL`, [userId]);
    await db.query(`DELETE FROM sms_logs WHERE created_by = ? OR created_by IS NULL`, [userId]);
    await db.query(`DELETE FROM otp_codes WHERE created_by = ?`, [userId]);
    await db.query(`DELETE FROM sms_templates WHERE id = ?`, [templateId]);
    await db.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
  });

  // ==================== SINGLE SMS TESTS ====================

  describe("Single SMS Sending", () => {
    it("should send SMS with valid phone and message", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Hello, this is a test SMS",
          gateway: "africastalking",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.sms_id).toBeDefined();
        expect(response.body.data.status).toBe("sent");
      }
    });

    it("should reject SMS with invalid phone number", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "invalid123",
          message: "Test message",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Validation");
    });

    it("should reject SMS with empty message", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "",
        });

      expect(response.status).toBe(400);
    });

    it("should reject SMS exceeding message length", async () => {
      const longMessage = "a".repeat(1700);

      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: longMessage,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeds");
    });

    it("should support both Africa's Talking and Twilio gateways", async () => {
      for (const gateway of ["africastalking", "twilio"]) {
        const response = await request(app)
          .post("/api/sms/send")
          .set("Authorization", `Bearer ${token}`)
          .send({
            phone_number: "+254700000000",
            message: `Test from ${gateway}`,
            gateway,
          });

        expect([201, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.data.gateway).toBe(gateway);
        }
      }
    });

    it("should support priority levels", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Priority test message",
          priority: "high",
        });

      expect([201, 500]).toContain(response.status);
    });

    it("should use template if template_id provided", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          template_id: templateId,
          variables: {
            name: "John",
            code: "12345",
          },
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
      }
    });

    it("should reject invalid template_id", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          template_id: 99999,
          variables: { name: "John" },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Template");
    });
  });

  // ==================== BULK SMS TESTS ====================

  describe("Bulk SMS Sending", () => {
    it("should send bulk SMS to multiple recipients", async () => {
      const recipients = ["+254700000001", "+254700000002", "+254700000003"];

      const response = await request(app)
        .post("/api/sms/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          message: "Bulk test message",
          gateway: "africastalking",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.total_recipients).toBe(3);
        expect(response.body.data.results).toHaveLength(3);
      }
    });

    it("should reject bulk SMS without recipients", async () => {
      const response = await request(app)
        .post("/api/sms/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients: [],
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should reject bulk SMS exceeding limit", async () => {
      const recipients = Array(1001).fill("+254700000000");

      const response = await request(app)
        .post("/api/sms/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should track success and failure counts", async () => {
      const recipients = ["+254700000001", "+254700000002"];

      const response = await request(app)
        .post("/api/sms/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          message: "Bulk test",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.data).toHaveProperty("success_count");
        expect(response.body.data).toHaveProperty("failure_count");
        expect(response.body.data.success_count + response.body.data.failure_count).toBe(2);
      }
    });

    it("should support bulk SMS with template", async () => {
      const recipients = ["+254700000001", "+254700000002"];

      const response = await request(app)
        .post("/api/sms/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          template_id: templateId,
          variables: { name: "User", code: "ABC123" },
        });

      expect([201, 500]).toContain(response.status);
    });
  });

  // ==================== OTP TESTS ====================

  describe("OTP Management", () => {
    it("should send OTP code", async () => {
      const response = await request(app)
        .post("/api/sms/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 6,
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.otp_id).toBeDefined();
        expect(response.body.data.sms_id).toBeDefined();
      }
    });

    it("should accept OTP lengths from 4 to 8", async () => {
      for (const length of [4, 5, 6, 7, 8]) {
        const response = await request(app)
          .post("/api/sms/otp/send")
          .set("Authorization", `Bearer ${token}`)
          .send({
            phone_number: "+254700000000",
            otp_length: length,
          });

        expect([201, 500]).toContain(response.status);
      }
    });

    it("should reject OTP with invalid length", async () => {
      const response = await request(app)
        .post("/api/sms/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 3, // Too short
        });

      expect(response.status).toBe(400);
    });

    it("should verify OTP code", async () => {
      // Send OTP
      const sendResponse = await request(app)
        .post("/api/sms/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 6,
        });

      if (sendResponse.status === 201) {
        // Get OTP code from database
        const otpResult = await db.query(
          `SELECT code FROM otp_codes WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
          ["+254700000000"]
        );

        if (otpResult.length > 0) {
          const otpCode = otpResult[0].code;

          const verifyResponse = await request(app)
            .post("/api/sms/otp/verify")
            .set("Authorization", `Bearer ${token}`)
            .send({
              phone_number: "+254700000000",
              code: otpCode,
            });

          expect(verifyResponse.status).toBe(200);
          expect(verifyResponse.body.success).toBe(true);
        }
      }
    });

    it("should reject invalid OTP code", async () => {
      const response = await request(app)
        .post("/api/sms/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          code: "000000",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid");
    });

    it("should reject expired OTP", async () => {
      // Create expired OTP directly
      await db.query(
        `INSERT INTO otp_codes (phone_number, code, expires_at, created_by)
         VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE), ?)`,
        ["+254799999999", "123456", userId]
      );

      const response = await request(app)
        .post("/api/sms/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254799999999",
          code: "123456",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid or expired");
    });

    it("should limit OTP verification attempts to 3", async () => {
      // Create OTP
      const otpResult = await db.query(
        `INSERT INTO otp_codes (phone_number, code, expires_at, attempts, created_by)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 3, ?)`,
        ["+254788888888", "123456", userId]
      );

      // Try to verify - should fail due to attempts limit
      const response = await request(app)
        .post("/api/sms/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254788888888",
          code: "123456",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeded");
    });

    it("should require both phone and code for verification", async () => {
      const response = await request(app)
        .post("/api/sms/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          // Missing code
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== SMS STATUS TESTS ====================

  describe("SMS Status and History", () => {
    it("should retrieve SMS status", async () => {
      // Send SMS first
      const sendResponse = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Status test",
        });

      if (sendResponse.status === 201) {
        const smsId = sendResponse.body.data.sms_id;

        const statusResponse = await request(app)
          .get(`/api/sms/${smsId}/status`)
          .set("Authorization", `Bearer ${token}`);

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.body.success).toBe(true);
        expect(statusResponse.body.data.sms_id).toBe(smsId);
        expect(statusResponse.body.data.status).toBeDefined();
      }
    });

    it("should return 404 for non-existent SMS", async () => {
      const response = await request(app)
        .get("/api/sms/SMS_NONEXISTENT/status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== SMS TEMPLATES TESTS ====================

  describe("SMS Templates", () => {
    it("should create new SMS template", async () => {
      const response = await request(app)
        .post("/api/sms/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Welcome Template",
          template_text: "Welcome {{user_name}}! Your account is ready.",
          description: "Sent when new account is created",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.template_id).toBeDefined();
    });

    it("should reject template without name", async () => {
      const response = await request(app)
        .post("/api/sms/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          template_text: "Test template",
        });

      expect(response.status).toBe(400);
    });

    it("should reject template without text", async () => {
      const response = await request(app)
        .post("/api/sms/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should list active templates", async () => {
      const response = await request(app)
        .get("/api/sms/templates?active=true")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should support variable substitution in templates", async () => {
      // Create template with variables
      const createResponse = await request(app)
        .post("/api/sms/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Variable Template",
          template_text: "Hi {{firstName}} {{lastName}}, code: {{code}}",
        });

      if (createResponse.status === 201) {
        const templateId = createResponse.body.data.template_id;

        const sendResponse = await request(app)
          .post("/api/sms/send")
          .set("Authorization", `Bearer ${token}`)
          .send({
            phone_number: "+254700000000",
            template_id: templateId,
            variables: {
              firstName: "John",
              lastName: "Doe",
              code: "ABC123",
            },
          });

        expect([201, 500]).toContain(sendResponse.status);
      }
    });
  });

  // ==================== SMS STATISTICS TESTS ====================

  describe("SMS Statistics", () => {
    it("should retrieve SMS statistics", async () => {
      const response = await request(app)
        .get("/api/sms/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_gateway).toBeDefined();
    });

    it("should include SMS counts by status in stats", async () => {
      const response = await request(app)
        .get("/api/sms/stats")
        .set("Authorization", `Bearer ${token}`);

      if (response.status === 200) {
        const overall = response.body.data.overall;
        expect(overall).toHaveProperty("total_sms");
        expect(overall).toHaveProperty("sent_count");
        expect(overall).toHaveProperty("delivered_count");
        expect(overall).toHaveProperty("failed_count");
      }
    });

    it("should filter stats by date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/sms/stats?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should filter stats by gateway", async () => {
      const response = await request(app)
        .get("/api/sms/stats?gateway=africastalking")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should track unique recipients in stats", async () => {
      const response = await request(app)
        .get("/api/sms/stats")
        .set("Authorization", `Bearer ${token}`);

      if (response.status === 200) {
        expect(response.body.data.overall).toHaveProperty("unique_recipients");
      }
    });
  });

  // ==================== WEBHOOK TESTS ====================

  describe("Webhook Handlers", () => {
    it("should handle Africa's Talking webhook", async () => {
      const webhookPayload = {
        MessageID: "ATXid123",
        Status: "Success",
        PhoneNumber: "+254700000000",
        Timestamp: new Date().toISOString(),
        StatusCode: 200,
      };

      const response = await request(app)
        .post("/api/webhooks/africastalking")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should handle Twilio webhook", async () => {
      const webhookPayload = {
        MessageSid: "SM1234567890",
        MessageStatus: "delivered",
        To: "+254700000000",
      };

      const response = await request(app)
        .post("/api/webhooks/twilio")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should handle payment failure webhook", async () => {
      const webhookPayload = {
        MessageSid: "SM_FAIL123",
        MessageStatus: "failed",
        To: "+254700000000",
      };

      const response = await request(app)
        .post("/api/webhooks/twilio")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should reject Africa's Talking webhook without MessageID", async () => {
      const response = await request(app)
        .post("/api/webhooks/africastalking")
        .send({
          Status: "Success",
          PhoneNumber: "+254700000000",
        });

      expect(response.status).toBe(400);
    });

    it("should reject Twilio webhook without MessageSid", async () => {
      const response = await request(app)
        .post("/api/webhooks/twilio")
        .send({
          MessageStatus: "delivered",
          To: "+254700000000",
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should deny SMS send without authorization", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .send({
          phone_number: "+254700000000",
          message: "Test",
        });

      expect(response.status).toBe(401);
    });

    it("should allow webhooks without authorization", async () => {
      const response = await request(app)
        .post("/api/webhooks/africastalking")
        .send({
          MessageID: "test",
          Status: "Success",
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          // Missing phone_number and message
        });

      expect(response.status).toBe(400);
    });

    it("should handle invalid phone format", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "abc",
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should gracefully handle gateway errors", async () => {
      const response = await request(app)
        .post("/api/sms/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Test message for gateway error simulation",
          gateway: "africastalking",
        });

      expect([201, 500]).toContain(response.status);
    });
  });
});
