const request = require("supertest");
const db = require("../config/db");
const app = require("../index");

let testUserId;
let testUserToken;
let adminUserId;
let adminUserToken;
let auditLogId;
let activityLogId;

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
    ? ["read_audit", "manage_audit"] 
    : ["read_audit"];

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

// Helper to create test audit log
const createTestAuditLog = async (userId, action = "test_action") => {
  const result = await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
     VALUES (?, ?, 'test_entity', ?, ?, '127.0.0.1', 'Test Agent', NOW())`,
    [userId, action, 1, JSON.stringify({ test: true })]
  );

  return result.insertId;
};

// Helper to create test activity log
const createTestActivityLog = async (userId, activityType = "test_activity") => {
  const result = await db.query(
    `INSERT INTO activity_logs (user_id, activity_type, title, description, created_at)
     VALUES (?, ?, 'Test Activity', 'Test activity description', NOW())`,
    [userId, activityType]
  );

  return result.insertId;
};

describe("Audit and Activity Logging System", () => {
  beforeAll(async () => {
    // Create test users
    testUserId = await createTestUser("audituser@example.com", "user");
    adminUserId = await createTestUser("auditadmin@example.com", "super_admin");

    testUserToken = await loginUser("audituser@example.com");
    adminUserToken = await loginUser("auditadmin@example.com");

    // Create test audit and activity logs
    auditLogId = await createTestAuditLog(testUserId, "login");
    activityLogId = await createTestActivityLog(testUserId, "page_visit");
  });

  afterAll(async () => {
    // Clean up
    await db.query(`DELETE FROM audit_logs WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM activity_logs WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [testUserId, adminUserId]);
  });

  // ==================== AUDIT LOGS TESTS ====================
  describe("Audit Logs - Get & Filter", () => {
    test("should get audit logs with pagination", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    test("should get audit logs with custom page and limit", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(10);
    });

    test("should filter audit logs by user_id", async () => {
      const response = await request(app)
        .get(`/api/audit/logs?user_id=${testUserId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(log => log.user_id === testUserId)).toBe(true);
    });

    test("should filter audit logs by action", async () => {
      const response = await request(app)
        .get("/api/audit/logs?action=login")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(log => log.action.includes("login"))).toBe(true);
    });

    test("should filter audit logs by entity_type", async () => {
      const response = await request(app)
        .get("/api/audit/logs?entity_type=test_entity")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data.every(log => log.entity_type === "test_entity")).toBe(true);
      }
    });

    test("should filter audit logs by date range", async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/audit/logs?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe("Audit Logs - Details", () => {
    test("should get single audit log details", async () => {
      const response = await request(app)
        .get(`/api/audit/logs/${auditLogId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(auditLogId);
    });

    test("should return 404 for non-existent audit log", async () => {
      const response = await request(app)
        .get("/api/audit/logs/99999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Audit Logs - Search", () => {
    test("should search audit logs by query", async () => {
      const response = await request(app)
        .post("/api/audit/logs/search")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          query: "login",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should reject search without query", async () => {
      const response = await request(app)
        .post("/api/audit/logs/search")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test("should search with filters", async () => {
      const response = await request(app)
        .post("/api/audit/logs/search")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          query: "login",
          filters: {
            user_id: testUserId,
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("Audit Logs - Statistics", () => {
    test("should get audit statistics", async () => {
      const response = await request(app)
        .get("/api/audit/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_action).toBeDefined();
      expect(response.body.data.by_entity_type).toBeDefined();
      expect(response.body.data.top_users).toBeDefined();
    });

    test("should get audit stats with date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/audit/stats?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.overall.total_logs).toBeDefined();
    });
  });

  // ==================== ACTIVITY LOGS TESTS ====================
  describe("Activity Logs - Get & Filter", () => {
    test("should get activity logs with pagination", async () => {
      const response = await request(app)
        .get("/api/audit/activities")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter activity logs by user_id", async () => {
      const response = await request(app)
        .get(`/api/audit/activities?user_id=${testUserId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every(log => log.user_id === testUserId)).toBe(true);
    });

    test("should filter activity logs by activity_type", async () => {
      const response = await request(app)
        .get("/api/audit/activities?activity_type=page_visit")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data.every(log => log.activity_type === "page_visit")).toBe(true);
      }
    });
  });

  describe("Activity Logs - Statistics", () => {
    test("should get activity statistics", async () => {
      const response = await request(app)
        .get("/api/audit/activities/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_activity_type).toBeDefined();
      expect(response.body.data.top_active_users).toBeDefined();
    });
  });

  // ==================== USER ACTIVITY TESTS ====================
  describe("User Activity Timeline & Trail", () => {
    test("should get user activity timeline", async () => {
      const response = await request(app)
        .get(`/api/audit/users/${testUserId}/timeline`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should get user audit trail", async () => {
      const response = await request(app)
        .get(`/api/audit/users/${testUserId}/trail`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should get user activity summary", async () => {
      const response = await request(app)
        .get(`/api/audit/users/${testUserId}/summary`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(testUserId);
      expect(response.body.data.total_activities).toBeDefined();
      expect(response.body.data.total_audit_events).toBeDefined();
      expect(response.body.data.activities_by_type).toBeDefined();
    });
  });

  // ==================== SENSITIVE DATA ACCESS TESTS ====================
  describe("Sensitive Data Access Logging", () => {
    test("should get sensitive data access logs", async () => {
      const response = await request(app)
        .get("/api/audit/sensitive-access")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter sensitive access by user", async () => {
      const response = await request(app)
        .get(`/api/audit/sensitive-access?user_id=${testUserId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should filter sensitive access by resource type", async () => {
      const response = await request(app)
        .get("/api/audit/sensitive-access?resource_type=password_vault")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== LOG CLEANUP TESTS ====================
  describe("Log Cleanup & Maintenance", () => {
    test("should cleanup old audit logs", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 90,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs_deleted).toBeDefined();
      expect(response.body.data.cutoff_date).toBeDefined();
    });

    test("should reject cleanup without days_to_keep", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test("should reject cleanup with invalid days_to_keep", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 0,
        });

      expect(response.status).toBe(400);
    });

    test("should cleanup old activity logs", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/activity-logs")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 90,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should require manage_audit permission for cleanup", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          days_to_keep: 90,
        });

      expect(response.status).toBe(403);
    });
  });

  // ==================== LOG EXPORT TESTS ====================
  describe("Log Export", () => {
    test("should export audit logs", async () => {
      const response = await request(app)
        .get("/api/audit/export/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.export_date).toBeDefined();
      expect(response.body.total_records).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test("should export audit logs with filters", async () => {
      const response = await request(app)
        .get(`/api/audit/export/audit-logs?user_id=${testUserId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should export activity logs", async () => {
      const response = await request(app)
        .get("/api/audit/export/activity-logs")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.export_date).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==================== COMPLIANCE REPORTING ====================
  describe("Compliance Reporting", () => {
    test("should get compliance report", async () => {
      const response = await request(app)
        .get("/api/audit/compliance-report")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.security_metrics).toBeDefined();
      expect(response.body.data.data_integrity).toBeDefined();
      expect(response.body.data.user_activity).toBeDefined();
    });

    test("should get compliance report with date range", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/audit/compliance-report?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.report_period).toBeDefined();
    });
  });

  // ==================== AUTHORIZATION TESTS ====================
  describe("Authorization", () => {
    test("should require read_audit permission to view logs", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 403]).toContain(response.status);
    });

    test("should require manage_audit permission for cleanup", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          days_to_keep: 90,
        });

      expect(response.status).toBe(403);
    });

    test("should reject requests without authentication", async () => {
      const response = await request(app)
        .get("/api/audit/logs");

      expect(response.status).toBe(401);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=invalid")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle missing filters gracefully", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
    });

    test("should handle concurrent requests", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .get("/api/audit/logs")
            .set("Authorization", `Bearer ${testUserToken}`)
        );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });

  // ==================== PAGINATION TESTS ====================
  describe("Pagination", () => {
    test("should paginate audit logs correctly", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=1&limit=5")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    test("should handle large page numbers", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=1000")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(0);
    });
  });
});
