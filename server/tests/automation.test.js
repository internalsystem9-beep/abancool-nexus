const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("Automation Engine", () => {
  let token;
  let adminToken;
  let userId;
  let adminId;
  let jobId;

  beforeAll(async () => {
    // Create regular user
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["user@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "user"]
    );

    // Create admin user
    const adminResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["admin@test.com", "hashedPassword123", "active"]
    );
    adminId = adminResult.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [adminId, "super_admin"]
    );

    await db.query(
      `INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`,
      [adminId, "manage_automation"]
    );

    await db.query(
      `INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`,
      [adminId, "read_automation"]
    );

    // Generate tokens
    token = jwt.sign(
      { id: userId, email: "user@test.com", roles: ["user"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );

    adminToken = jwt.sign(
      { id: adminId, email: "admin@test.com", roles: ["super_admin"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM job_logs`);
    await db.query(`DELETE FROM job_executions`);
    await db.query(`DELETE FROM automated_jobs`);
    await db.query(`DELETE FROM audit_logs WHERE user_id IN (?, ?)`, [userId, adminId]);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [userId, adminId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [userId, adminId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [userId, adminId]);
  });

  // ==================== JOB CREATION TESTS ====================

  describe("Job Creation", () => {
    it("should create a job with valid data", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Daily Invoice Generation",
          job_type: "generate_invoice",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
          job_config: { invoice_type: "monthly", auto_send: true },
          description: "Generates invoices every day at 9 AM",
          is_active: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job_id).toBeDefined();
      expect(response.body.data.job_name).toBe("Daily Invoice Generation");
      expect(response.body.data.status).toBe("created");

      jobId = response.body.data.job_id;
    });

    it("should reject job without name", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Job name is required");
    });

    it("should reject job with short name", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "AB",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("3-100");
    });

    it("should reject job with invalid job type", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Test Job",
          job_type: "invalid_type",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid job type");
    });

    it("should reject job with invalid cron expression", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Test Job",
          job_type: "send_email",
          cron_expression: "invalid cron",
          timezone: "UTC",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid cron");
    });

    it("should reject job without timezone", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Test Job",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Timezone is required");
    });

    it("should support all valid job types", async () => {
      const jobTypes = [
        "send_email",
        "generate_invoice",
        "send_sms",
        "send_whatsapp",
        "backup",
        "report",
        "notification",
        "cleanup",
      ];

      for (const jobType of jobTypes) {
        const response = await request(app)
          .post("/api/automation/jobs")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            job_name: `Test ${jobType} job`,
            job_type,
            cron_expression: "0 9 * * *",
            timezone: "UTC",
          });

        expect(response.status).toBe(201);
        expect(response.body.data.job_type).toBe(jobType);
      }
    });

    it("should reject unauthorized job creation", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          job_name: "Unauthorized Job",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(403);
    });

    it("should reject job creation without authentication", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .send({
          job_name: "Test Job",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(401);
    });
  });

  // ==================== JOB LISTING TESTS ====================

  describe("Job Listing", () => {
    it("should list all jobs", async () => {
      const response = await request(app)
        .get("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter jobs by type", async () => {
      const response = await request(app)
        .get("/api/automation/jobs?job_type=send_email")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(job => {
        expect(job.job_type).toBe("send_email");
      });
    });

    it("should filter jobs by active status", async () => {
      const response = await request(app)
        .get("/api/automation/jobs?is_active=true")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(job => {
        expect(job.is_active).toBe(1);
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/automation/jobs?page=1&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  // ==================== JOB DETAILS TESTS ====================

  describe("Job Details", () => {
    it("should get job details with execution history", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job).toBeDefined();
      expect(response.body.data.recent_executions).toBeDefined();
    });

    it("should return 404 for non-existent job", async () => {
      const response = await request(app)
        .get("/api/automation/jobs/99999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== JOB UPDATE TESTS ====================

  describe("Job Update", () => {
    it("should update job name", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Updated Daily Invoice Generation",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.updated_fields).toContain("job_name");
    });

    it("should update cron expression", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          cron_expression: "0 10 * * *",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated_fields).toContain("cron_expression");
    });

    it("should reject invalid cron on update", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          cron_expression: "invalid",
        });

      expect(response.status).toBe(400);
    });

    it("should update job config", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_config: { invoice_type: "daily", auto_send: false },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated_fields).toContain("job_config");
    });

    it("should reject unauthorized job update", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          job_name: "Hacked Job Name",
        });

      expect(response.status).toBe(403);
    });
  });

  // ==================== JOB TOGGLE TESTS ====================

  describe("Job Toggle", () => {
    it("should disable job", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          is_active: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.is_active).toBe(false);
      expect(response.body.data.status).toBe("disabled");
    });

    it("should enable job", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          is_active: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.is_active).toBe(true);
      expect(response.body.data.status).toBe("enabled");
    });

    it("should reject non-boolean is_active", async () => {
      const response = await request(app)
        .patch(`/api/automation/jobs/${jobId}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          is_active: "yes",
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== JOB EXECUTION TESTS ====================

  describe("Job Execution", () => {
    it("should manually execute job", async () => {
      const response = await request(app)
        .post(`/api/automation/jobs/${jobId}/execute`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.execution_id).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.duration_seconds).toBeDefined();
    });

    it("should track execution time", async () => {
      const response = await request(app)
        .post(`/api/automation/jobs/${jobId}/execute`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(201);
      expect(response.body.data.duration_seconds).toBeGreaterThanOrEqual(0);
    });

    it("should reject unauthorized job execution", async () => {
      const response = await request(app)
        .post(`/api/automation/jobs/${jobId}/execute`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  // ==================== JOB HISTORY TESTS ====================

  describe("Job History", () => {
    it("should get job execution history", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}/history`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter history by status", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}/history?status=completed`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(execution => {
        expect(execution.execution_status).toBe("completed");
      });
    });

    it("should support pagination in history", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}/history?page=1&limit=10`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  // ==================== JOB LOGS TESTS ====================

  describe("Job Logs", () => {
    it("should get job logs", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}/logs`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should support pagination in logs", async () => {
      const response = await request(app)
        .get(`/api/automation/jobs/${jobId}/logs?page=1&limit=50`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });
  });

  // ==================== JOB DELETION TESTS ====================

  describe("Job Deletion", () => {
    it("should delete job", async () => {
      // Create a temporary job to delete
      const createResponse = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Job to Delete",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      const tempJobId = createResponse.body.data.job_id;

      const response = await request(app)
        .delete(`/api/automation/jobs/${tempJobId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("deleted");
    });

    it("should reject unauthorized job deletion", async () => {
      const response = await request(app)
        .delete(`/api/automation/jobs/${jobId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("should return 404 when deleting non-existent job", async () => {
      const response = await request(app)
        .delete("/api/automation/jobs/99999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== STATISTICS TESTS ====================

  describe("Statistics", () => {
    it("should get automation statistics", async () => {
      const response = await request(app)
        .get("/api/automation/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_status).toBeDefined();
      expect(response.body.data.by_job_type).toBeDefined();
    });

    it("should include job counts in stats", async () => {
      const response = await request(app)
        .get("/api/automation/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const overall = response.body.data.overall;
      expect(overall).toHaveProperty("total_jobs");
      expect(overall).toHaveProperty("active_jobs");
    });

    it("should filter stats by date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      const response = await request(app)
        .get(`/api/automation/stats?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it("should include stats by job type", async () => {
      const response = await request(app)
        .get("/api/automation/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.by_job_type)).toBe(true);
    });

    it("should include failed job stats", async () => {
      const response = await request(app)
        .get("/api/automation/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.failed_jobs).toBeDefined();
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .get("/api/automation/jobs");

      expect(response.status).toBe(401);
    });

    it("should enforce read_automation permission", async () => {
      const response = await request(app)
        .get("/api/automation/jobs")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("should enforce manage_automation permission for creation", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${token}`)
        .send({
          job_name: "Unauthorized Job",
          job_type: "send_email",
          cron_expression: "0 9 * * *",
          timezone: "UTC",
        });

      expect(response.status).toBe(403);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/automation/jobs")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("should handle invalid job ID", async () => {
      const response = await request(app)
        .get("/api/automation/jobs/invalid_id")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([404, 400]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      const response = await request(app)
        .patch("/api/automation/jobs/invalid_id")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          job_name: "Test",
        });

      expect([400, 404, 500]).toContain(response.status);
    });
  });
});
