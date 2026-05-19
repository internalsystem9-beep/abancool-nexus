const request = require("supertest");
const db = require("../config/db");
const app = require("../index");

let testUserId;
let testUserToken;
let adminUserId;
let adminUserToken;
let alertRuleId;

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
    ? ["read_devops", "manage_devops"] 
    : ["read_devops"];

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

describe("DevOps Module with Server Monitoring", () => {
  beforeAll(async () => {
    // Create test users
    testUserId = await createTestUser("devopsuser@example.com", "user");
    adminUserId = await createTestUser("devopsadmin@example.com", "super_admin");

    testUserToken = await loginUser("devopsuser@example.com");
    adminUserToken = await loginUser("devopsadmin@example.com");
  });

  afterAll(async () => {
    // Clean up
    await db.query(`DELETE FROM alert_rules WHERE created_by IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM server_health_checks WHERE checked_by IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [testUserId, adminUserId]);
  });

  // ==================== SERVER METRICS TESTS ====================
  describe("Server Metrics", () => {
    test("should get server metrics", async () => {
      const response = await request(app)
        .get("/api/devops/metrics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.server_info).toBeDefined();
      expect(response.body.data.cpu).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.node_process).toBeDefined();
    });

    test("should include CPU information", async () => {
      const response = await request(app)
        .get("/api/devops/metrics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.cpu.count).toBeGreaterThan(0);
      expect(response.body.data.cpu.load_average).toBeDefined();
    });

    test("should include memory information", async () => {
      const response = await request(app)
        .get("/api/devops/metrics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.memory.total).toBeGreaterThan(0);
      expect(response.body.data.memory.usage_percent).toBeDefined();
    });
  });

  describe("CPU Usage", () => {
    test("should get CPU usage details", async () => {
      const response = await request(app)
        .get("/api/devops/cpu")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total_cores).toBeGreaterThan(0);
      expect(response.body.data.cpu_info).toBeDefined();
      expect(response.body.data.load_average).toBeDefined();
      expect(response.body.data.load_percent).toBeDefined();
    });

    test("should include load averages", async () => {
      const response = await request(app)
        .get("/api/devops/cpu")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.load_average.one_minute).toBeDefined();
      expect(response.body.data.load_average.five_minutes).toBeDefined();
      expect(response.body.data.load_average.fifteen_minutes).toBeDefined();
    });
  });

  describe("Memory Usage", () => {
    test("should get memory usage details", async () => {
      const response = await request(app)
        .get("/api/devops/memory")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBeDefined();
      expect(response.body.data.process).toBeDefined();
    });

    test("should include system memory metrics", async () => {
      const response = await request(app)
        .get("/api/devops/memory")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.system.total).toBeGreaterThan(0);
      expect(response.body.data.system.usage_percent).toBeDefined();
    });
  });

  describe("Server Uptime", () => {
    test("should get server uptime", async () => {
      const response = await request(app)
        .get("/api/devops/uptime")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBeDefined();
      expect(response.body.data.process).toBeDefined();
    });

    test("should include formatted uptime", async () => {
      const response = await request(app)
        .get("/api/devops/uptime")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.system.formatted).toBeDefined();
      expect(response.body.data.process.formatted).toBeDefined();
    });
  });

  // ==================== HEALTH CHECK TESTS ====================
  describe("Health Checks", () => {
    test("should get health check status", async () => {
      const response = await request(app)
        .get("/api/devops/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.checks).toBeDefined();
    });

    test("should include database check", async () => {
      const response = await request(app)
        .get("/api/devops/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.checks.database).toBeDefined();
    });

    test("should include memory check", async () => {
      const response = await request(app)
        .get("/api/devops/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.checks.memory).toBeDefined();
    });

    test("should record health check", async () => {
      const response = await request(app)
        .post("/api/devops/health/record")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          status: "healthy",
          details: { database: "ok", memory: "ok" },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.health_check_id).toBeDefined();
    });

    test("should reject invalid health status", async () => {
      const response = await request(app)
        .post("/api/devops/health/record")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          status: "invalid_status",
        });

      expect(response.status).toBe(400);
    });

    test("should get health check history", async () => {
      const response = await request(app)
        .get("/api/devops/health/history")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter health checks by status", async () => {
      const response = await request(app)
        .get("/api/devops/health/history?status=healthy")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== PROCESS MONITORING TESTS ====================
  describe("Process Monitoring", () => {
    test("should get process status", async () => {
      const response = await request(app)
        .get("/api/devops/processes")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.node_process).toBeDefined();
      expect(response.body.data.services).toBeDefined();
    });

    test("should include process information", async () => {
      const response = await request(app)
        .get("/api/devops/processes")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.node_process.pid).toBeDefined();
      expect(response.body.data.node_process.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== LOG MONITORING TESTS ====================
  describe("Log Monitoring", () => {
    test("should get logs summary", async () => {
      const response = await request(app)
        .get("/api/devops/logs/summary")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.audit_logs).toBeDefined();
      expect(response.body.data.error_logs).toBeDefined();
      expect(response.body.data.activity_logs).toBeDefined();
    });

    test("should get logs summary with date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/devops/logs/summary?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.period).toBeDefined();
    });
  });

  // ==================== ALERT MANAGEMENT TESTS ====================
  describe("Alert Rules - Create", () => {
    test("should create alert rule", async () => {
      const response = await request(app)
        .post("/api/devops/alerts")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          alert_name: "High CPU Usage",
          condition: "greater_than",
          threshold: 80,
          metric_type: "cpu_usage",
          notification_channels: ["email", "slack"],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alert_rule_id).toBeDefined();
      alertRuleId = response.body.data.alert_rule_id;
    });

    test("should reject alert without name", async () => {
      const response = await request(app)
        .post("/api/devops/alerts")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          condition: "greater_than",
          threshold: 80,
          metric_type: "cpu_usage",
        });

      expect(response.status).toBe(400);
    });

    test("should reject alert without condition", async () => {
      const response = await request(app)
        .post("/api/devops/alerts")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          alert_name: "Test Alert",
          threshold: 80,
          metric_type: "cpu_usage",
        });

      expect(response.status).toBe(400);
    });

    test("should reject alert without threshold", async () => {
      const response = await request(app)
        .post("/api/devops/alerts")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          alert_name: "Test Alert",
          condition: "greater_than",
          metric_type: "cpu_usage",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Alert Rules - Read", () => {
    test("should get alert rules", async () => {
      const response = await request(app)
        .get("/api/devops/alerts")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter alert rules by active status", async () => {
      const response = await request(app)
        .get("/api/devops/alerts?is_active=true")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("Alert Rules - Update", () => {
    test("should update alert rule", async () => {
      const response = await request(app)
        .patch(`/api/devops/alerts/${alertRuleId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          threshold: 90,
          is_active: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should return 404 for non-existent alert", async () => {
      const response = await request(app)
        .patch("/api/devops/alerts/99999")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          threshold: 90,
        });

      expect(response.status).toBe(404);
    });
  });

  describe("Alert Rules - Delete", () => {
    test("should delete alert rule", async () => {
      const response = await request(app)
        .delete(`/api/devops/alerts/${alertRuleId}`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should return 404 when deleting non-existent alert", async () => {
      const response = await request(app)
        .delete("/api/devops/alerts/99999")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== BACKUP MONITORING TESTS ====================
  describe("Backup Monitoring", () => {
    test("should get backup status", async () => {
      const response = await request(app)
        .get("/api/devops/backups/status")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.files).toBeDefined();
      expect(response.body.data.schedule).toBeDefined();
    });
  });

  // ==================== SYSTEM DIAGNOSTICS TESTS ====================
  describe("System Diagnostics", () => {
    test("should get system diagnostics", async () => {
      const response = await request(app)
        .get("/api/devops/diagnostics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.server).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.environment).toBeDefined();
      expect(response.body.data.checks).toBeDefined();
    });

    test("should include server information", async () => {
      const response = await request(app)
        .get("/api/devops/diagnostics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.server.hostname).toBeDefined();
      expect(response.body.data.server.platform).toBeDefined();
    });
  });

  // ==================== AUTHORIZATION TESTS ====================
  describe("Authorization", () => {
    test("should require read_devops permission to view metrics", async () => {
      const response = await request(app)
        .get("/api/devops/metrics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 403]).toContain(response.status);
    });

    test("should require manage_devops permission for health record", async () => {
      const response = await request(app)
        .post("/api/devops/health/record")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          status: "healthy",
        });

      expect(response.status).toBe(403);
    });

    test("should require manage_devops permission to create alerts", async () => {
      const response = await request(app)
        .post("/api/devops/alerts")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          alert_name: "Test",
          condition: "greater_than",
          threshold: 80,
          metric_type: "cpu",
        });

      expect(response.status).toBe(403);
    });

    test("should reject requests without authentication", async () => {
      const response = await request(app)
        .get("/api/devops/metrics");

      expect(response.status).toBe(401);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const response = await request(app)
        .get("/api/devops/health/history?page=invalid")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle missing parameters gracefully", async () => {
      const response = await request(app)
        .get("/api/devops/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
    });

    test("should handle concurrent requests", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .get("/api/devops/metrics")
            .set("Authorization", `Bearer ${testUserToken}`)
        );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });

  // ==================== PAGINATION TESTS ====================
  describe("Pagination", () => {
    test("should paginate health check history", async () => {
      const response = await request(app)
        .get("/api/devops/health/history?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    test("should paginate alert rules", async () => {
      const response = await request(app)
        .get("/api/devops/alerts?page=1&limit=5")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  // ==================== DATA STRUCTURE TESTS ====================
  describe("Data Structures", () => {
    test("server metrics should include required fields", async () => {
      const response = await request(app)
        .get("/api/devops/metrics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.body.data).toHaveProperty("timestamp");
      expect(response.body.data).toHaveProperty("server_info");
      expect(response.body.data).toHaveProperty("cpu");
      expect(response.body.data).toHaveProperty("memory");
      expect(response.body.data).toHaveProperty("node_process");
    });

    test("health check should include status field", async () => {
      const response = await request(app)
        .get("/api/devops/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.body.data).toHaveProperty("status");
      expect(response.body.data).toHaveProperty("checks");
    });

    test("diagnostics should include environment info", async () => {
      const response = await request(app)
        .get("/api/devops/diagnostics")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.body.data.environment).toHaveProperty("node_version");
      expect(response.body.data.environment).toHaveProperty("environment");
    });
  });
});
