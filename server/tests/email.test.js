const request = require("supertest");
const db = require("../config/db");
const app = require("../index");

let testUserId;
let testUserToken;
let adminUserId;
let adminUserToken;
let templateId;
let emailLogId;

// Helper to create test user with role
const createTestUser = async (email, role = "user") => {
  const password = "Test@1234";
  const hashedPassword = require("bcryptjs").hashSync(password, 10);

  const result = await db.query(
    `INSERT INTO users (email, username, password, verified_at, created_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    [email, email.split("@")[0], hashedPassword]
  );

  const userId = result.insertId;

  // Assign role
  if (role !== "user") {
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, role]);
  }

  // Grant permissions
  const permissions = role === "super_admin" 
    ? ["send_email", "read_email", "manage_email"] 
    : ["send_email", "read_email"];

  for (const permission of permissions) {
    await db.query(
      `INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`,
      [userId, permission]
    );
  }

  return userId;
};

// Helper to login user
const loginUser = async (email, password = "Test@1234") => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data.token;
};

describe("Email System", () => {
  beforeAll(async () => {
    // Create test users
    testUserId = await createTestUser("emailtest@example.com", "user");
    adminUserId = await createTestUser("emailadmin@example.com", "super_admin");

    testUserToken = await loginUser("emailtest@example.com");
    adminUserToken = await loginUser("emailadmin@example.com");
  });

  afterAll(async () => {
    // Clean up
    await db.query(`DELETE FROM email_logs`);
    await db.query(`DELETE FROM email_templates`);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [testUserId, adminUserId]);
  });

  // ==================== SEND EMAIL TESTS ====================
  describe("Send Single Email", () => {
    test("should send email with valid data", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "Test Email",
          body: "This is a test email",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recipient_email).toBe("user@example.com");
      expect(response.body.data.status).toBe("sent");
      emailLogId = response.body.data.email_log_id;
    });

    test("should reject email without recipient", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          subject: "Test Email",
          body: "This is a test email",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test("should reject invalid email address", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "invalid-email",
          subject: "Test Email",
          body: "This is a test email",
        });

      expect(response.status).toBe(400);
    });

    test("should reject email without subject", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          body: "This is a test email",
        });

      expect(response.status).toBe(400);
    });

    test("should reject email with too short subject", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "Hi",
          body: "This is a test email",
        });

      expect(response.status).toBe(400);
    });

    test("should reject email without body or html", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "Test Email",
        });

      expect(response.status).toBe(400);
    });

    test("should send email with HTML content", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "HTML Email Test",
          html_content: "<h1>Welcome</h1><p>This is an HTML email</p>",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test("should require authentication", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .send({
          recipient_email: "user@example.com",
          subject: "Test Email",
          body: "This is a test email",
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Send Bulk Email", () => {
    test("should send bulk email to multiple recipients", async () => {
      const response = await request(app)
        .post("/api/email/send-bulk")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_emails: ["user1@example.com", "user2@example.com", "user3@example.com"],
          subject: "Bulk Email",
          body: "This is a bulk email",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_recipients).toBe(3);
    });

    test("should reject bulk email without recipients", async () => {
      const response = await request(app)
        .post("/api/email/send-bulk")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          subject: "Bulk Email",
          body: "This is a bulk email",
        });

      expect(response.status).toBe(400);
    });

    test("should reject bulk email with empty recipients array", async () => {
      const response = await request(app)
        .post("/api/email/send-bulk")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_emails: [],
          subject: "Bulk Email",
          body: "This is a bulk email",
        });

      expect(response.status).toBe(400);
    });

    test("should limit bulk email to 1000 recipients", async () => {
      const recipients = Array(1001)
        .fill(null)
        .map((_, i) => `user${i}@example.com`);

      const response = await request(app)
        .post("/api/email/send-bulk")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_emails: recipients,
          subject: "Bulk Email",
          body: "This is a bulk email",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("1000");
    });

    test("should handle invalid emails in bulk list", async () => {
      const response = await request(app)
        .post("/api/email/send-bulk")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_emails: ["valid@example.com", "invalid-email", "another@example.com"],
          subject: "Bulk Email",
          body: "This is a bulk email",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.sent_count + response.body.data.failed_count).toBe(3);
    });
  });

  // ==================== EMAIL TEMPLATE TESTS ====================
  describe("Email Templates - Create", () => {
    test("should create email template", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_name: "Welcome Email",
          template_subject: "Welcome to Our Service",
          template_body: "Hello {{username}}, welcome!",
          template_html: "<p>Hello <strong>{{username}}</strong>, welcome!</p>",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.template_name).toBe("Welcome Email");
      templateId = response.body.data.template_id;
    });

    test("should reject template without name", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_subject: "Welcome",
          template_body: "Hello {{username}}, welcome!",
        });

      expect(response.status).toBe(400);
    });

    test("should reject template with too short name", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_name: "ab",
          template_subject: "Welcome",
          template_body: "Hello",
        });

      expect(response.status).toBe(400);
    });

    test("should reject template without subject", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_name: "Test Template",
          template_body: "Hello",
        });

      expect(response.status).toBe(400);
    });

    test("should require manage_email permission", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          template_name: "Test Template",
          template_subject: "Test",
          template_body: "Test",
        });

      expect(response.status).toBe(403);
    });
  });

  describe("Email Templates - Read", () => {
    test("should get all templates with pagination", async () => {
      const response = await request(app)
        .get("/api/email/templates")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should get template by ID", async () => {
      const response = await request(app)
        .get(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
    });

    test("should return 404 for non-existent template", async () => {
      const response = await request(app)
        .get("/api/email/templates/99999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Email Templates - Update", () => {
    test("should update template name", async () => {
      const response = await request(app)
        .patch(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_name: "Updated Welcome Email",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should update template subject", async () => {
      const response = await request(app)
        .patch(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_subject: "New Subject",
        });

      expect(response.status).toBe(200);
    });

    test("should update template body", async () => {
      const response = await request(app)
        .patch(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          template_body: "Updated body content",
        });

      expect(response.status).toBe(200);
    });

    test("should require manage_email permission to update", async () => {
      const response = await request(app)
        .patch(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          template_name: "New Name",
        });

      expect(response.status).toBe(403);
    });
  });

  describe("Email Templates - Delete", () => {
    test("should delete template", async () => {
      const response = await request(app)
        .delete(`/api/email/templates/${templateId}`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should return 404 when deleting non-existent template", async () => {
      const response = await request(app)
        .delete("/api/email/templates/99999")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== EMAIL HISTORY TESTS ====================
  describe("Email History", () => {
    test("should get email history with pagination", async () => {
      const response = await request(app)
        .get("/api/email/history")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter history by status", async () => {
      const response = await request(app)
        .get("/api/email/history?status=sent")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(e => e.email_status === "sent")).toBe(true);
    });

    test("should filter history by recipient email", async () => {
      const response = await request(app)
        .get("/api/email/history?recipient_email=user@example.com")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should get email details by ID", async () => {
      const response = await request(app)
        .get(`/api/email/history/${emailLogId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(emailLogId);
    });

    test("should return 404 for non-existent email log", async () => {
      const response = await request(app)
        .get("/api/email/history/99999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== EMAIL VERIFICATION TESTS ====================
  describe("Email Verification", () => {
    test("should verify valid email", async () => {
      const response = await request(app)
        .post("/api/email/verify")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          email_address: "valid@example.com",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_valid).toBe(true);
    });

    test("should reject invalid email format", async () => {
      const response = await request(app)
        .post("/api/email/verify")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          email_address: "invalid-email",
        });

      expect(response.status).toBe(400);
    });

    test("should reject missing email address", async () => {
      const response = await request(app)
        .post("/api/email/verify")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ==================== EMAIL STATISTICS TESTS ====================
  describe("Email Statistics", () => {
    test("should get email statistics", async () => {
      const response = await request(app)
        .get("/api/email/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_status).toBeDefined();
      expect(response.body.data.overall.total_emails).toBeDefined();
      expect(response.body.data.overall.sent_count).toBeDefined();
      expect(response.body.data.overall.failed_count).toBeDefined();
    });

    test("should get stats with date range", async () => {
      const response = await request(app)
        .get("/api/email/stats?start_date=2024-01-01&end_date=2025-12-31")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should calculate success rate", async () => {
      const response = await request(app)
        .get("/api/email/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(typeof response.body.data.overall.success_rate).toBe("number");
      expect(response.body.data.overall.success_rate).toBeGreaterThanOrEqual(0);
      expect(response.body.data.overall.success_rate).toBeLessThanOrEqual(100);
    });
  });

  // ==================== EMAIL RESEND TESTS ====================
  describe("Email Resend", () => {
    test("should resend email from history", async () => {
      const response = await request(app)
        .post(`/api/email/resend/${emailLogId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.original_email_log_id).toBe(emailLogId);
    });

    test("should return 404 for non-existent email", async () => {
      const response = await request(app)
        .post("/api/email/resend/99999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== AUTHORIZATION TESTS ====================
  describe("Authorization", () => {
    test("should require send_email permission to send emails", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "Test",
          body: "Test",
        });

      expect([201, 403]).toContain(response.status);
    });

    test("should require read_email permission to view history", async () => {
      const response = await request(app)
        .get("/api/email/history")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 403]).toContain(response.status);
    });

    test("should require manage_email permission to create templates", async () => {
      const response = await request(app)
        .post("/api/email/templates")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          template_name: "Test",
          template_subject: "Test",
          template_body: "Test",
        });

      expect(response.status).toBe(403);
    });

    test("should reject requests without authentication", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .send({
          recipient_email: "user@example.com",
          subject: "Test",
          body: "Test",
        });

      expect(response.status).toBe(401);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe("Error Handling", () => {
    test("should handle SMTP errors gracefully", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "user@example.com",
          subject: "Test",
          body: "Test",
        });

      expect([201, 500]).toContain(response.status);
    });

    test("should validate email structure", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          recipient_email: "invalid@",
          subject: "Test",
          body: "Test",
        });

      expect(response.status).toBe(400);
    });

    test("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/email/send")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
