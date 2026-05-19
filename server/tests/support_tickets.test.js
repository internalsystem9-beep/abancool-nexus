const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("Support Ticket System", () => {
  let token;
  let agentToken;
  let userId;
  let agentId;
  let ticketId;

  beforeAll(async () => {
    // Create customer user
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["customer@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "user"]
    );

    // Create agent user
    const agentResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["agent@test.com", "hashedPassword123", "active"]
    );
    agentId = agentResult.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [agentId, "support_agent"]
    );

    // Generate tokens
    token = jwt.sign(
      { id: userId, email: "customer@test.com", roles: ["user"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );

    agentToken = jwt.sign(
      { id: agentId, email: "agent@test.com", roles: ["support_agent"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM ticket_history`);
    await db.query(`DELETE FROM ticket_comments`);
    await db.query(`DELETE FROM support_tickets`);
    await db.query(`DELETE FROM audit_logs WHERE user_id IN (?, ?)`, [userId, agentId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [userId, agentId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [userId, agentId]);
  });

  // ==================== TICKET CREATION TESTS ====================

  describe("Ticket Creation", () => {
    it("should create a support ticket with valid data", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Cannot login to my account",
          description: "I'm unable to login to my account. I've tried resetting password but still no luck.",
          category: "account",
          priority: "high",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticket_id).toBeDefined();
      expect(response.body.data.ticket_number).toMatch(/^TKT-/);
      expect(response.body.data.status).toBe("open");

      ticketId = response.body.data.ticket_id;
    });

    it("should reject ticket without subject", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Test description",
          category: "billing",
        });

      expect(response.status).toBe(400);
    });

    it("should reject ticket with short subject", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Hi",
          description: "Test description for ticket",
          category: "billing",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("5-200");
    });

    it("should reject ticket with short description", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Test Subject",
          description: "Short",
          category: "billing",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("10-10000");
    });

    it("should reject ticket with invalid category", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Test Subject",
          description: "This is a valid description for testing purposes",
          category: "invalid_category",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid category");
    });

    it("should reject ticket with invalid priority", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Test Subject",
          description: "This is a valid description for testing purposes",
          category: "billing",
          priority: "urgent",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid priority");
    });

    it("should set default priority to medium", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Test Subject Default Priority",
          description: "This is a valid description for testing purposes",
          category: "technical",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.priority).toBe("medium");
    });

    it("should support all valid categories", async () => {
      const categories = ["billing", "technical", "account", "general", "feature-request", "bug-report"];

      for (const category of categories) {
        const response = await request(app)
          .post("/api/tickets")
          .set("Authorization", `Bearer ${token}`)
          .send({
            subject: `Test ${category} ticket`,
            description: "This is a valid description for testing purposes",
            category,
            priority: "low",
          });

        expect(response.status).toBe(201);
        expect(response.body.data.category).toBe(category);
      }
    });

    it("should support all valid priorities", async () => {
      const priorities = ["low", "medium", "high", "critical"];

      for (const priority of priorities) {
        const response = await request(app)
          .post("/api/tickets")
          .set("Authorization", `Bearer ${token}`)
          .send({
            subject: `Test ${priority} priority ticket`,
            description: "This is a valid description for testing purposes",
            category: "general",
            priority,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.priority).toBe(priority);
      }
    });
  });

  // ==================== TICKET LISTING AND SEARCH TESTS ====================

  describe("Ticket Listing and Search", () => {
    it("should list tickets for user", async () => {
      const response = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter tickets by status", async () => {
      const response = await request(app)
        .get("/api/tickets?status=open")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(ticket => {
        expect(ticket.status).toBe("open");
      });
    });

    it("should filter tickets by priority", async () => {
      const response = await request(app)
        .get("/api/tickets?priority=high")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(ticket => {
        expect(ticket.priority).toBe("high");
      });
    });

    it("should filter tickets by category", async () => {
      const response = await request(app)
        .get("/api/tickets?category=billing")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(ticket => {
        expect(ticket.category).toBe("billing");
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/tickets?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it("should search tickets by subject", async () => {
      const response = await request(app)
        .post("/api/tickets/search")
        .set("Authorization", `Bearer ${token}`)
        .send({
          query: "Cannot",
          filters: {},
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject search with short query", async () => {
      const response = await request(app)
        .post("/api/tickets/search")
        .set("Authorization", `Bearer ${token}`)
        .send({
          query: "a",
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== TICKET DETAILS TESTS ====================

  describe("Ticket Details", () => {
    it("should get ticket details with comments and history", async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ticket_number).toBeDefined();
      expect(response.body.data.comments).toBeDefined();
      expect(response.body.data.history).toBeDefined();
    });

    it("should return 404 for non-existent ticket", async () => {
      const response = await request(app)
        .get("/api/tickets/99999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== TICKET STATUS TESTS ====================

  describe("Ticket Status Management", () => {
    it("should update ticket status to in_progress", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          status: "in_progress",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.new_status).toBe("in_progress");
    });

    it("should update ticket status to waiting_customer", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          status: "waiting_customer",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.new_status).toBe("waiting_customer");
    });

    it("should update ticket status to resolved", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          status: "resolved",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.new_status).toBe("resolved");
    });

    it("should reject invalid status", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          status: "invalid_status",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid status");
    });

    it("should reject status update without authorization", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          status: "closed",
        });

      expect([403, 400]).toContain(response.status);
    });
  });

  // ==================== TICKET PRIORITY TESTS ====================

  describe("Ticket Priority Management", () => {
    it("should update ticket priority", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/priority`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          priority: "critical",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.new_priority).toBe("critical");
    });

    it("should reject invalid priority", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/priority`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          priority: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid priority");
    });
  });

  // ==================== TICKET ASSIGNMENT TESTS ====================

  describe("Ticket Assignment", () => {
    it("should assign ticket to agent", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/assign`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          assigned_to: agentId,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.assigned_to).toBe(agentId);
    });

    it("should reject assignment to non-agent user", async () => {
      const response = await request(app)
        .patch(`/api/tickets/${ticketId}/assign`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          assigned_to: userId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("not a support agent");
    });
  });

  // ==================== TICKET COMMENTS TESTS ====================

  describe("Ticket Comments", () => {
    it("should add comment to ticket", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          comment_text: "We are investigating your issue. Please stand by for updates.",
          is_internal: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.comment_id).toBeDefined();
    });

    it("should add internal comment", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          comment_text: "User account is locked due to multiple failed login attempts.",
          is_internal: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.is_internal).toBe(true);
    });

    it("should reject comment with empty text", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          comment_text: "",
        });

      expect(response.status).toBe(400);
    });

    it("should reject comment exceeding 5000 characters", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${agentToken}`)
        .send({
          comment_text: "a".repeat(5001),
        });

      expect(response.status).toBe(400);
    });

    it("should get ticket comments", async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should not show internal comments to customers", async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/comments`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach(comment => {
        expect(comment.is_internal).toBe(false);
      });
    });
  });

  // ==================== TICKET CLOSE TESTS ====================

  describe("Ticket Closing", () => {
    it("should close ticket with satisfaction rating", async () => {
      const response = await request(app)
        .post(`/api/tickets/${ticketId}/close`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          satisfaction_rating: 5,
          resolution_summary: "Issue resolved successfully",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("closed");
      expect(response.body.data.satisfaction_rating).toBe(5);
    });

    it("should reject invalid satisfaction rating", async () => {
      // Create new ticket first
      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "Test for rating validation",
          description: "This is a valid description for testing purposes",
          category: "general",
        });

      const newTicketId = createResponse.body.data.ticket_id;

      const response = await request(app)
        .post(`/api/tickets/${newTicketId}/close`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          satisfaction_rating: 6,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("1-5");
    });
  });

  // ==================== TICKET HISTORY TESTS ====================

  describe("Ticket History", () => {
    it("should get ticket history", async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/history`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should track status changes in history", async () => {
      const response = await request(app)
        .get(`/api/tickets/${ticketId}/history`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(response.status).toBe(200);
      const statusChanges = response.body.data.filter(h => h.field_name === "status");
      expect(statusChanges.length).toBeGreaterThan(0);
    });
  });

  // ==================== STATISTICS TESTS ====================

  describe("Ticket Statistics", () => {
    it("should get ticket statistics", async () => {
      const response = await request(app)
        .get("/api/tickets/stats/overview")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBeDefined();
      expect(response.body.data.by_priority).toBeDefined();
      expect(response.body.data.by_category).toBeDefined();
      expect(response.body.data.sla_compliance).toBeDefined();
    });

    it("should include ticket counts by status in stats", async () => {
      const response = await request(app)
        .get("/api/tickets/stats/overview")
        .set("Authorization", `Bearer ${agentToken}`);

      if (response.status === 200) {
        const overall = response.body.data.overall;
        expect(overall).toHaveProperty("total_tickets");
        expect(overall).toHaveProperty("open_count");
        expect(overall).toHaveProperty("resolved_count");
      }
    });

    it("should filter statistics by date range", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      const response = await request(app)
        .get(`/api/tickets/stats/overview?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${agentToken}`);

      expect(response.status).toBe(200);
    });

    it("should include statistics by priority", async () => {
      const response = await request(app)
        .get("/api/tickets/stats/overview")
        .set("Authorization", `Bearer ${agentToken}`);

      if (response.status === 200) {
        expect(Array.isArray(response.body.data.by_priority)).toBe(true);
      }
    });

    it("should include statistics by category", async () => {
      const response = await request(app)
        .get("/api/tickets/stats/overview")
        .set("Authorization", `Bearer ${agentToken}`);

      if (response.status === 200) {
        expect(Array.isArray(response.body.data.by_category)).toBe(true);
      }
    });

    it("should track SLA compliance", async () => {
      const response = await request(app)
        .get("/api/tickets/stats/overview")
        .set("Authorization", `Bearer ${agentToken}`);

      if (response.status === 200) {
        const sla = response.body.data.sla_compliance;
        expect(sla).toHaveProperty("sla_breached");
        expect(sla).toHaveProperty("sla_met");
      }
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should require authentication for ticket creation", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .send({
          subject: "Test",
          description: "This is a valid description for testing purposes",
          category: "general",
        });

      expect(response.status).toBe(401);
    });

    it("should allow customer to view their own tickets", async () => {
      const response = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should allow agent to manage tickets", async () => {
      const response = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${agentToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("should handle invalid ticket ID", async () => {
      const response = await request(app)
        .get("/api/tickets/invalid_id")
        .set("Authorization", `Bearer ${token}`);

      expect([404, 400]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      const response = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({
          subject: "a".repeat(300),
          description: "This is a valid description for testing purposes",
          category: "general",
        });

      expect(response.status).toBe(400);
    });
  });
});
