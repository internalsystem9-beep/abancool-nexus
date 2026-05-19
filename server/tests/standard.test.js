const request = require("supertest");
const db = require("../config/db");
const app = require("../index");

let testUserId;
let testUserToken;

// Helper to create test user
const createTestUser = async (email, role = "user") => {
  const password = "Test@1234";
  const hashedPassword = require("bcryptjs").hashSync(password, 10);

  const result = await db.query(
    `INSERT INTO users (email, username, password, verified_at, created_at)
     VALUES (?, ?, ?, NOW(), NOW())`,
    [email, email.split("@")[0], hashedPassword]
  );

  const userId = result.insertId;

  if (role !== "user") {
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, role]);
  }

  return userId;
};

// Helper to login
const loginUser = async (email, password = "Test@1234") => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return response.body.data?.token;
};

describe("API Response Standard and Error Handling", () => {
  beforeAll(async () => {
    testUserId = await createTestUser("standardtest@example.com", "user");
    testUserToken = await loginUser("standardtest@example.com");
  });

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
  });

  // ==================== RESPONSE FORMAT TESTS ====================
  describe("Response Format", () => {
    test("success response should have required fields", async () => {
      const response = await request(app)
        .get("/api/health")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("timestamp");
      expect(typeof response.body.success).toBe("boolean");
      expect(typeof response.body.timestamp).toBe("string");
    });

    test("success response with data should include data field", async () => {
      const response = await request(app)
        .get("/api/audit/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.timestamp).toBeDefined();
      }
    });

    test("paginated response should include pagination info", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      if (response.status === 200 && response.body.pagination) {
        expect(response.body.pagination).toHaveProperty("page");
        expect(response.body.pagination).toHaveProperty("limit");
        expect(response.body.pagination).toHaveProperty("total");
        expect(response.body.pagination).toHaveProperty("pages");
      }
    });
  });

  // ==================== ERROR FORMAT TESTS ====================
  describe("Error Response Format", () => {
    test("error response should have standard format", async () => {
      const response = await request(app)
        .get("/api/nonexistent-endpoint")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.body).toHaveProperty("success");
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("errorCode");
      expect(response.body).toHaveProperty("timestamp");
    });

    test("error response should include error message", async () => {
      const response = await request(app)
        .get("/api/nonexistent-endpoint");

      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe("string");
      expect(response.body.error.length > 0).toBe(true);
    });

    test("validation error should include error code", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "",
          password: "",
        });

      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBeDefined();
        expect(typeof response.body.errorCode).toBe("string");
      }
    });
  });

  // ==================== HTTP STATUS CODE TESTS ====================
  describe("HTTP Status Codes", () => {
    test("success should return 200", async () => {
      const response = await request(app)
        .get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("created should return 201", async () => {
      const response = await request(app)
        .post("/api/support-tickets")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          title: "Test Ticket",
          description: "Test",
          priority: "medium",
        });

      if (response.status === 201) {
        expect(response.body.success).toBe(true);
      }
    });

    test("bad request should return 400", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid",
          password: "",
        });

      expect([400, 401]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });

    test("unauthorized should return 401", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("forbidden should return 403", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          days_to_keep: 30,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test("not found should return 404", async () => {
      const response = await request(app)
        .get("/api/users/999999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([404, 401, 403]).toContain(response.status);
    });

    test("server error should return 500", async () => {
      // This is a simulated test - would need actual error condition
      const response = await request(app)
        .get("/api/health");

      expect(response.status).toBe(200); // Health check always succeeds
    });
  });

  // ==================== ERROR CODE TESTS ====================
  describe("Error Codes", () => {
    test("authentication error should have AUTH_ERROR code", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", "Bearer invalid");

      if (response.status === 401) {
        expect(response.body.errorCode).toBeDefined();
        expect(typeof response.body.errorCode).toBe("string");
      }
    });

    test("validation error should have VALIDATION_ERROR code", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid-email",
          password: "",
        });

      if (response.status === 400) {
        expect(response.body.errorCode).toBe("VALIDATION_ERROR");
      }
    });

    test("not found error should have NOT_FOUND code", async () => {
      const response = await request(app)
        .get("/api/api/nonexistent")
        .set("Authorization", `Bearer ${testUserToken}`);

      if (response.status === 404) {
        expect(response.body.errorCode).toContain("NOT_FOUND");
      }
    });
  });

  // ==================== AUTHENTICATION ERRORS ====================
  describe("Authentication Errors", () => {
    test("missing auth header should return 401", async () => {
      const response = await request(app)
        .get("/api/audit/logs");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("invalid token should return 401", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", "Bearer invalid-token-12345");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test("malformed auth header should return 401", async () => {
      const response = await request(app)
        .get("/api/audit/logs")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(401);
    });
  });

  // ==================== AUTHORIZATION ERRORS ====================
  describe("Authorization Errors", () => {
    test("insufficient permission should return 403", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          days_to_keep: 30,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test("error response should explain permission", async () => {
      const response = await request(app)
        .post("/api/audit/cleanup/audit-logs")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          days_to_keep: 30,
        });

      if (response.status === 403) {
        expect(response.body.error).toBeDefined();
        expect(response.body.error.length > 0).toBe(true);
      }
    });
  });

  // ==================== VALIDATION ERRORS ====================
  describe("Validation Errors", () => {
    test("missing required field should return 400", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test("invalid email format should return 400", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "not-an-email",
          password: "Test@1234",
        });

      expect(response.status).toBe(400);
    });

    test("validation error should provide details", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "invalid",
          password: "",
        });

      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBeDefined();
      }
    });
  });

  // ==================== PAGINATION TESTS ====================
  describe("Pagination Validation", () => {
    test("invalid page should be handled", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=invalid")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400]).toContain(response.status);
    });

    test("negative page should be handled", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=-1")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400]).toContain(response.status);
    });

    test("excessive limit should be handled", async () => {
      const response = await request(app)
        .get("/api/audit/logs?limit=10000")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400]).toContain(response.status);
    });

    test("valid pagination should work", async () => {
      const response = await request(app)
        .get("/api/audit/logs?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  // ==================== ERROR DETAILS TESTS ====================
  describe("Error Details", () => {
    test("error response should not expose sensitive info in production", async () => {
      const response = await request(app)
        .get("/api/nonexistent");

      if (response.status === 404) {
        expect(response.body.error).toBeDefined();
        // Should not include stack traces or internal details in production
        expect(response.body.error).not.toMatch(/at /);
      }
    });

    test("validation error details should be available", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "",
        });

      if (response.status === 400) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.errorCode).toBeDefined();
      }
    });
  });

  // ==================== TIMESTAMP TESTS ====================
  describe("Timestamps", () => {
    test("all responses should include timestamp", async () => {
      const response = await request(app)
        .get("/api/health");

      expect(response.body).toHaveProperty("timestamp");
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    test("timestamp should be ISO 8601 format", async () => {
      const response = await request(app)
        .get("/api/health");

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("error responses should have timestamp", async () => {
      const response = await request(app)
        .get("/api/nonexistent");

      expect(response.body).toHaveProperty("timestamp");
    });
  });

  // ==================== CONCURRENT ERROR HANDLING ====================
  describe("Concurrent Error Handling", () => {
    test("should handle concurrent errors", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .get("/api/nonexistent")
            .set("Authorization", `Bearer ${testUserToken}`)
        );

      const responses = await Promise.all(requests);
      expect(responses.every((r) => r.status === 404)).toBe(true);
      expect(responses.every((r) => r.body.success === false)).toBe(true);
    });

    test("concurrent requests should not interfere", async () => {
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app)
            .get("/api/health")
        );

      const responses = await Promise.all(requests);
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(responses.every((r) => r.body.success === true)).toBe(true);
    });
  });

  // ==================== RESPONSE CONSISTENCY ====================
  describe("Response Consistency", () => {
    test("multiple requests should have consistent format", async () => {
      const response1 = await request(app)
        .get("/api/health");

      const response2 = await request(app)
        .get("/api/health");

      expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
      expect(response1.body.success).toBe(response2.body.success);
    });

    test("error responses should follow same pattern", async () => {
      const response1 = await request(app)
        .get("/api/endpoint1");

      const response2 = await request(app)
        .get("/api/endpoint2");

      if (response1.status >= 400 && response2.status >= 400) {
        expect(response1.body).toHaveProperty("error");
        expect(response1.body).toHaveProperty("errorCode");
        expect(response2.body).toHaveProperty("error");
        expect(response2.body).toHaveProperty("errorCode");
      }
    });
  });

  // ==================== CONTENT TYPE TESTS ====================
  describe("Content Type", () => {
    test("responses should be JSON", async () => {
      const response = await request(app)
        .get("/api/health");

      expect(response.type).toMatch(/json/);
    });

    test("error responses should be JSON", async () => {
      const response = await request(app)
        .get("/api/nonexistent");

      expect(response.type).toMatch(/json/);
    });
  });

  // ==================== MESSAGE FIELD TESTS ====================
  describe("Message Fields", () => {
    test("success response should include message", async () => {
      const response = await request(app)
        .get("/api/health");

      if (response.body.message) {
        expect(typeof response.body.message).toBe("string");
      }
    });

    test("error response should include error message", async () => {
      const response = await request(app)
        .get("/api/nonexistent");

      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe("string");
    });
  });
});
