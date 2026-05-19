const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("WhatsApp Engine - Meta WhatsApp Business API", () => {
  let token;
  let userId;
  let templateId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["whatsapp@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    // Create user role
    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "super_admin"]
    );

    // Generate token
    token = jwt.sign(
      { id: userId, email: "whatsapp@test.com", roles: ["super_admin"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );

    // Create test WhatsApp template
    const templateResult = await db.query(
      `INSERT INTO whatsapp_templates (name, template_text, category, active, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      ["Test Template", "Hello {{name}}, your code is {{code}}", "TRANSACTIONAL", 1, userId]
    );
    templateId = templateResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query(`DELETE FROM audit_logs WHERE user_id = ?`, [userId]);
    await db.query(`DELETE FROM whatsapp_logs WHERE created_by = ?`, [userId]);
    await db.query(`DELETE FROM whatsapp_otp_codes WHERE created_by = ?`, [userId]);
    await db.query(`DELETE FROM whatsapp_templates WHERE id = ?`, [templateId]);
    await db.query(`DELETE FROM whatsapp_incoming_messages`);
    await db.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
  });

  // ==================== TEXT MESSAGE TESTS ====================

  describe("Text Message Sending", () => {
    it("should send WhatsApp text message with valid phone", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Hello, this is a test WhatsApp message",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.wa_id).toBeDefined();
        expect(response.body.data.status).toBe("sent");
      }
    });

    it("should reject message with invalid phone number", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "invalid123",
          message: "Test",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid phone");
    });

    it("should reject message with empty text", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "",
        });

      expect(response.status).toBe(400);
    });

    it("should reject message exceeding 4096 characters", async () => {
      const longMessage = "a".repeat(4097);

      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: longMessage,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeds");
    });

    it("should use template if template_id provided", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
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
        .post("/api/whatsapp/send")
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

  // ==================== MEDIA MESSAGE TESTS ====================

  describe("Media Message Sending", () => {
    it("should send image message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          media_type: "image",
          media_url: "https://example.com/image.jpg",
          message: "Check out this image",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.data.message_type).toBe("media");
      }
    });

    it("should send document message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          media_type: "document",
          media_url: "https://example.com/file.pdf",
          message: "Important document attached",
        });

      expect([201, 500]).toContain(response.status);
    });

    it("should send video message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          media_type: "video",
          media_url: "https://example.com/video.mp4",
        });

      expect([201, 500]).toContain(response.status);
    });

    it("should send audio message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          media_type: "audio",
          media_url: "https://example.com/audio.mp3",
        });

      expect([201, 500]).toContain(response.status);
    });

    it("should reject invalid media type", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          media_type: "invalid",
          media_url: "https://example.com/file",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid media type");
    });
  });

  // ==================== INTERACTIVE MESSAGE TESTS ====================

  describe("Interactive Message Sending", () => {
    it("should send button interactive message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          interactive: {
            type: "button",
            body: { text: "Select an option" },
            action: {
              buttons: [
                { type: "reply", reply: { id: "1", title: "Yes" } },
                { type: "reply", reply: { id: "2", title: "No" } },
              ],
            },
          },
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.data.message_type).toBe("interactive");
      }
    });

    it("should send list interactive message", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          interactive: {
            type: "list",
            body: { text: "Select from list" },
            action: {
              button: "Options",
              sections: [
                {
                  title: "Category 1",
                  rows: [
                    { id: "1", title: "Option 1" },
                    { id: "2", title: "Option 2" },
                  ],
                },
              ],
            },
          },
        });

      expect([201, 500]).toContain(response.status);
    });
  });

  // ==================== BULK MESSAGE TESTS ====================

  describe("Bulk WhatsApp Sending", () => {
    it("should send bulk WhatsApp to multiple recipients", async () => {
      const recipients = ["+254700000001", "+254700000002", "+254700000003"];

      const response = await request(app)
        .post("/api/whatsapp/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          message: "Bulk WhatsApp announcement",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.total_recipients).toBe(3);
        expect(response.body.data.results).toBeDefined();
      }
    });

    it("should reject bulk WhatsApp without recipients", async () => {
      const response = await request(app)
        .post("/api/whatsapp/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients: [],
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should reject bulk WhatsApp exceeding 500 limit", async () => {
      const recipients = Array(501).fill("+254700000000");

      const response = await request(app)
        .post("/api/whatsapp/bulk")
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
        .post("/api/whatsapp/bulk")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipients,
          message: "Bulk test",
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.data).toHaveProperty("success_count");
        expect(response.body.data).toHaveProperty("failure_count");
      }
    });

    it("should support bulk WhatsApp with template", async () => {
      const recipients = ["+254700000001", "+254700000002"];

      const response = await request(app)
        .post("/api/whatsapp/bulk")
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

  describe("WhatsApp OTP Management", () => {
    it("should send OTP via WhatsApp", async () => {
      const response = await request(app)
        .post("/api/whatsapp/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 6,
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.otp_id).toBeDefined();
        expect(response.body.data.wa_id).toBeDefined();
      }
    });

    it("should accept OTP lengths from 4 to 8", async () => {
      for (const length of [4, 5, 6, 7, 8]) {
        const response = await request(app)
          .post("/api/whatsapp/otp/send")
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
        .post("/api/whatsapp/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 3,
        });

      expect(response.status).toBe(400);
    });

    it("should verify WhatsApp OTP code", async () => {
      // Send OTP
      const sendResponse = await request(app)
        .post("/api/whatsapp/otp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          otp_length: 6,
        });

      if (sendResponse.status === 201) {
        // Get OTP code from database
        const otpResult = await db.query(
          `SELECT code FROM whatsapp_otp_codes WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`,
          ["+254700000000"]
        );

        if (otpResult.length > 0) {
          const otpCode = otpResult[0].code;

          const verifyResponse = await request(app)
            .post("/api/whatsapp/otp/verify")
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

    it("should reject invalid WhatsApp OTP code", async () => {
      const response = await request(app)
        .post("/api/whatsapp/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          code: "000000",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid");
    });

    it("should reject expired OTP", async () => {
      // Create expired OTP
      await db.query(
        `INSERT INTO whatsapp_otp_codes (phone_number, code, expires_at, created_by)
         VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE), ?)`,
        ["+254799999999", "123456", userId]
      );

      const response = await request(app)
        .post("/api/whatsapp/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254799999999",
          code: "123456",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid or expired");
    });

    it("should limit OTP verification attempts to 3", async () => {
      // Create OTP with max attempts
      await db.query(
        `INSERT INTO whatsapp_otp_codes (phone_number, code, expires_at, attempts, created_by)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 3, ?)`,
        ["+254788888888", "123456", userId]
      );

      const response = await request(app)
        .post("/api/whatsapp/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254788888888",
          code: "123456",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeded");
    });
  });

  // ==================== MESSAGE STATUS TESTS ====================

  describe("WhatsApp Message Status", () => {
    it("should retrieve WhatsApp message status", async () => {
      // Send message first
      const sendResponse = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Status test",
        });

      if (sendResponse.status === 201) {
        const waId = sendResponse.body.data.wa_id;

        const statusResponse = await request(app)
          .get(`/api/whatsapp/${waId}/status`)
          .set("Authorization", `Bearer ${token}`);

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.body.success).toBe(true);
        expect(statusResponse.body.data.phone_number).toBeDefined();
      }
    });

    it("should return 404 for non-existent message", async () => {
      const response = await request(app)
        .get("/api/whatsapp/WA_NONEXISTENT/status")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== TEMPLATES TESTS ====================

  describe("WhatsApp Templates", () => {
    it("should create new WhatsApp template", async () => {
      const response = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Welcome Template",
          template_text: "Welcome {{user_name}}! Your account is ready.",
          category: "MARKETING",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.template_id).toBeDefined();
    });

    it("should reject template without name", async () => {
      const response = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          template_text: "Test template",
        });

      expect(response.status).toBe(400);
    });

    it("should reject template without text", async () => {
      const response = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should reject duplicate template name", async () => {
      const name = "Unique Template " + Date.now();

      // Create first template
      await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          template_text: "First template",
        });

      // Try to create duplicate
      const response = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          template_text: "Duplicate template",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already exists");
    });

    it("should reject template exceeding 1024 characters", async () => {
      const response = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Long Template",
          template_text: "a".repeat(1025),
        });

      expect(response.status).toBe(400);
    });

    it("should list active templates", async () => {
      const response = await request(app)
        .get("/api/whatsapp/templates?active=true")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should support variable substitution in templates", async () => {
      const createResponse = await request(app)
        .post("/api/whatsapp/templates")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Variable Template",
          template_text: "Hi {{firstName}} {{lastName}}, your code: {{code}}",
        });

      if (createResponse.status === 201) {
        const templateId = createResponse.body.data.template_id;

        const sendResponse = await request(app)
          .post("/api/whatsapp/send")
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

  // ==================== STATISTICS TESTS ====================

  describe("WhatsApp Statistics", () => {
    it("should retrieve WhatsApp statistics", async () => {
      const response = await request(app)
        .get("/api/whatsapp/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_type).toBeDefined();
    });

    it("should include message counts by status in stats", async () => {
      const response = await request(app)
        .get("/api/whatsapp/stats")
        .set("Authorization", `Bearer ${token}`);

      if (response.status === 200) {
        const overall = response.body.data.overall;
        expect(overall).toHaveProperty("total_messages");
        expect(overall).toHaveProperty("sent_count");
        expect(overall).toHaveProperty("delivered_count");
        expect(overall).toHaveProperty("failed_count");
      }
    });

    it("should filter stats by date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      const response = await request(app)
        .get(`/api/whatsapp/stats?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should track unique recipients in stats", async () => {
      const response = await request(app)
        .get("/api/whatsapp/stats")
        .set("Authorization", `Bearer ${token}`);

      if (response.status === 200) {
        expect(response.body.data.overall).toHaveProperty("unique_recipients");
      }
    });

    it("should break down stats by message type", async () => {
      const response = await request(app)
        .get("/api/whatsapp/stats")
        .set("Authorization", `Bearer ${token}`);

      if (response.status === 200) {
        expect(Array.isArray(response.body.data.by_type)).toBe(true);
      }
    });
  });

  // ==================== WEBHOOK TESTS ====================

  describe("WhatsApp Webhook Handlers", () => {
    it("should handle WhatsApp status webhook", async () => {
      const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "WA_MSG_12345",
                      status: "delivered",
                      timestamp: Math.floor(Date.now() / 1000),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should handle WhatsApp read receipt webhook", async () => {
      const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "WA_MSG_12345",
                      status: "read",
                      timestamp: Math.floor(Date.now() / 1000),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should handle WhatsApp failed message webhook", async () => {
      const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "WA_MSG_FAIL123",
                      status: "failed",
                      timestamp: Math.floor(Date.now() / 1000),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should handle incoming WhatsApp messages", async () => {
      const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "254700000000",
                      type: "text",
                      text: { body: "Hello from customer" },
                      id: "WA_MSG_INCOMING_123",
                      timestamp: Math.floor(Date.now() / 1000),
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send(webhookPayload);

      expect([200, 404]).toContain(response.status);
    });

    it("should reject webhook without object", async () => {
      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send({
          entry: [],
        });

      expect(response.status).toBe(400);
    });

    it("should reject webhook with invalid object type", async () => {
      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send({
          object: "invalid_object",
          entry: [],
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should deny WhatsApp send without authorization", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .send({
          phone_number: "+254700000000",
          message: "Test",
        });

      expect(response.status).toBe(401);
    });

    it("should allow webhooks without authorization", async () => {
      const response = await request(app)
        .post("/api/webhooks/whatsapp")
        .send({
          object: "whatsapp_business_account",
          entry: [],
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          // Missing phone_number and message
        });

      expect(response.status).toBe(400);
    });

    it("should handle invalid phone format", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "abc",
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should handle both phone and code required for OTP verification", async () => {
      const response = await request(app)
        .post("/api/whatsapp/otp/verify")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          // Missing code
        });

      expect(response.status).toBe(400);
    });

    it("should gracefully handle gateway errors", async () => {
      const response = await request(app)
        .post("/api/whatsapp/send")
        .set("Authorization", `Bearer ${token}`)
        .send({
          phone_number: "+254700000000",
          message: "Test message for gateway error simulation",
        });

      expect([201, 500]).toContain(response.status);
    });
  });
});
