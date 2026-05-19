const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("Real-time Features with Socket.IO", () => {
  let token;
  let adminToken;
  let userId;
  let adminId;
  let recipientId;

  beforeAll(async () => {
    // Create user 1
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["user1@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "user"]
    );

    // Create user 2
    const user2Result = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["user2@test.com", "hashedPassword123", "active"]
    );
    recipientId = user2Result.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [recipientId, "user"]
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
      [adminId, "send_notifications"]
    );

    await db.query(
      `INSERT INTO user_permissions (user_id, permission_name) VALUES (?, ?)`,
      [adminId, "send_alerts"]
    );

    // Generate tokens
    token = jwt.sign(
      { id: userId, email: "user1@test.com", roles: ["user"] },
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
    await db.query(`DELETE FROM room_activity`);
    await db.query(`DELETE FROM alerts`);
    await db.query(`DELETE FROM activity_logs`);
    await db.query(`DELETE FROM chat_messages`);
    await db.query(`DELETE FROM notifications`);
    await db.query(`DELETE FROM socket_connections`);
    await db.query(`DELETE FROM audit_logs WHERE user_id IN (?, ?, ?)`, [userId, recipientId, adminId]);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [userId, adminId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?, ?)`, [userId, recipientId, adminId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?, ?)`, [userId, recipientId, adminId]);
  });

  // ==================== NOTIFICATION TESTS ====================

  describe("Notifications", () => {
    it("should send notification to single recipient", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [recipientId],
          title: "New Message",
          message: "You have a new message",
          notification_type: "info",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notification_id).toBeDefined();
      expect(response.body.data.delivered).toBeGreaterThanOrEqual(0);
    });

    it("should send notification to multiple recipients", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [userId, recipientId],
          title: "System Update",
          message: "System will be down for maintenance",
          notification_type: "warning",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.total_recipients).toBe(2);
    });

    it("should reject notification without recipients", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Test",
          message: "Test message",
          notification_type: "info",
        });

      expect(response.status).toBe(400);
    });

    it("should reject notification without title", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [recipientId],
          message: "Test message",
          notification_type: "info",
        });

      expect(response.status).toBe(400);
    });

    it("should reject notification without message", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [recipientId],
          title: "Test",
          notification_type: "info",
        });

      expect(response.status).toBe(400);
    });

    it("should reject notification with invalid type", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [recipientId],
          title: "Test",
          message: "Test message",
          notification_type: "invalid",
        });

      expect(response.status).toBe(400);
    });

    it("should support all valid notification types", async () => {
      const types = ["info", "warning", "error", "success", "alert"];

      for (const type of types) {
        const response = await request(app)
          .post("/api/realtime/notifications")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            recipient_user_ids: [recipientId],
            title: `Test ${type}`,
            message: "Test message",
            notification_type: type,
          });

        expect(response.status).toBe(201);
      }
    });

    it("should get user notifications", async () => {
      const response = await request(app)
        .get("/api/realtime/notifications")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter notifications by read status", async () => {
      const response = await request(app)
        .get("/api/realtime/notifications?read=false")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should support pagination for notifications", async () => {
      const response = await request(app)
        .get("/api/realtime/notifications?page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it("should mark notification as read", async () => {
      // First get a notification
      const getResponse = await request(app)
        .get("/api/realtime/notifications")
        .set("Authorization", `Bearer ${token}`);

      if (getResponse.body.data.length > 0) {
        const notificationId = getResponse.body.data[0].id;

        const response = await request(app)
          .patch(`/api/realtime/notifications/${notificationId}/read`)
          .set("Authorization", `Bearer ${token}`);

        expect([200, 404]).toContain(response.status);
      }
    });

    it("should reject unauthorized notification sending", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_user_ids: [recipientId],
          title: "Test",
          message: "Test message",
          notification_type: "info",
        });

      expect(response.status).toBe(403);
    });
  });

  // ==================== CHAT MESSAGE TESTS ====================

  describe("Chat Messages", () => {
    it("should send chat message", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_id: recipientId,
          message: "Hello, how are you?",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message_id).toBeDefined();
      expect(response.body.data.message).toBe("Hello, how are you?");
    });

    it("should reject message without recipient", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          message: "Test message",
        });

      expect(response.status).toBe(400);
    });

    it("should reject empty message", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_id: recipientId,
          message: "",
        });

      expect(response.status).toBe(400);
    });

    it("should reject message exceeding 5000 characters", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_id: recipientId,
          message: "a".repeat(5001),
        });

      expect(response.status).toBe(400);
    });

    it("should support message types", async () => {
      const types = ["text", "image", "file", "attachment"];

      for (const type of types) {
        const response = await request(app)
          .post("/api/realtime/messages")
          .set("Authorization", `Bearer ${token}`)
          .send({
            recipient_id: recipientId,
            message: `Test ${type} message`,
            message_type: type,
          });

        expect(response.status).toBe(201);
      }
    });

    it("should get chat history", async () => {
      const response = await request(app)
        .get(`/api/realtime/messages/history?peer_id=${recipientId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should require peer_id for chat history", async () => {
      const response = await request(app)
        .get("/api/realtime/messages/history")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it("should support pagination in chat history", async () => {
      const response = await request(app)
        .get(`/api/realtime/messages/history?peer_id=${recipientId}&page=1&limit=25`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(25);
    });
  });

  // ==================== PRESENCE TESTS ====================

  describe("Presence Tracking", () => {
    it("should get list of online users", async () => {
      const response = await request(app)
        .get("/api/realtime/users/online")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.online_users).toBeDefined();
      expect(response.body.data.total_online).toBeGreaterThanOrEqual(0);
    });

    it("should check if specific user is online", async () => {
      const response = await request(app)
        .get(`/api/realtime/users/${userId}/online`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.is_online).toBeDefined();
      expect(response.body.data.connection_count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== ROOM TESTS ====================

  describe("Room Management", () => {
    it("should get room members", async () => {
      const response = await request(app)
        .get("/api/realtime/rooms/test-room/members")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.room_id).toBe("test-room");
      expect(Array.isArray(response.body.data.members)).toBe(true);
    });

    it("should broadcast to room", async () => {
      const response = await request(app)
        .post("/api/realtime/rooms/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          room_id: "test-room",
          event_type: "message_update",
          message: "Room message",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.room_id).toBe("test-room");
    });

    it("should reject broadcast without room_id", async () => {
      const response = await request(app)
        .post("/api/realtime/rooms/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          event_type: "test",
          message: "Test",
        });

      expect(response.status).toBe(400);
    });

    it("should reject broadcast without event_type", async () => {
      const response = await request(app)
        .post("/api/realtime/rooms/broadcast")
        .set("Authorization", `Bearer ${token}`)
        .send({
          room_id: "test-room",
          message: "Test",
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== ACTIVITY FEED TESTS ====================

  describe("Activity Feed", () => {
    it("should log activity", async () => {
      const response = await request(app)
        .post("/api/realtime/activities")
        .set("Authorization", `Bearer ${token}`)
        .send({
          activity_type: "created_project",
          activity_title: "New Project",
          activity_description: "User created a new project",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activity_id).toBeDefined();
    });

    it("should get activity feed", async () => {
      const response = await request(app)
        .get("/api/realtime/activities")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter activity feed by type", async () => {
      const response = await request(app)
        .get("/api/realtime/activities?activity_type=created_project")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should support pagination in activity feed", async () => {
      const response = await request(app)
        .get("/api/realtime/activities?page=1&limit=15")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(15);
    });
  });

  // ==================== ALERT TESTS ====================

  describe("Real-time Alerts", () => {
    it("should send alert", async () => {
      const response = await request(app)
        .post("/api/realtime/alerts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          alert_type: "system",
          alert_level: "high",
          title: "System Maintenance",
          message: "Server will restart in 10 minutes",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alert_id).toBeDefined();
    });

    it("should reject alert with invalid level", async () => {
      const response = await request(app)
        .post("/api/realtime/alerts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          alert_type: "system",
          alert_level: "invalid",
          title: "Test",
          message: "Test alert",
        });

      expect(response.status).toBe(400);
    });

    it("should support all alert levels", async () => {
      const levels = ["low", "medium", "high", "critical"];

      for (const level of levels) {
        const response = await request(app)
          .post("/api/realtime/alerts")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            alert_type: "security",
            alert_level: level,
            title: `${level} Alert`,
            message: `Test ${level} alert`,
          });

        expect(response.status).toBe(201);
      }
    });

    it("should send alert to specific users", async () => {
      const response = await request(app)
        .post("/api/realtime/alerts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          alert_type: "notification",
          alert_level: "medium",
          title: "User Alert",
          message: "This is for specific users",
          target_users: [userId, recipientId],
        });

      expect(response.status).toBe(201);
    });

    it("should reject unauthorized alert sending", async () => {
      const response = await request(app)
        .post("/api/realtime/alerts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          alert_type: "system",
          alert_level: "high",
          title: "Test",
          message: "Test",
        });

      expect(response.status).toBe(403);
    });
  });

  // ==================== CONNECTION STATISTICS TESTS ====================

  describe("Connection Statistics", () => {
    it("should get connection statistics", async () => {
      const response = await request(app)
        .get("/api/realtime/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.current_active_connections).toBeDefined();
      expect(response.body.data.current_active_users).toBeDefined();
      expect(response.body.data.database_stats).toBeDefined();
      expect(response.body.data.room_stats).toBeDefined();
    });

    it("should include active connection count in stats", async () => {
      const response = await request(app)
        .get("/api/realtime/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.current_active_connections).toBeGreaterThanOrEqual(0);
    });

    it("should include active user count in stats", async () => {
      const response = await request(app)
        .get("/api/realtime/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.current_active_users).toBeGreaterThanOrEqual(0);
    });

    it("should include database statistics", async () => {
      const response = await request(app)
        .get("/api/realtime/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.database_stats.total_connections).toBeDefined();
      expect(response.body.data.database_stats.unique_users).toBeDefined();
    });

    it("should include room statistics", async () => {
      const response = await request(app)
        .get("/api/realtime/stats")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.room_stats.total_rooms).toBeDefined();
      expect(response.body.data.room_stats.total_members).toBeDefined();
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should require authentication for notifications", async () => {
      const response = await request(app)
        .get("/api/realtime/notifications");

      expect(response.status).toBe(401);
    });

    it("should require authentication for messages", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .send({
          recipient_id: recipientId,
          message: "Test",
        });

      expect(response.status).toBe(401);
    });

    it("should enforce send_notifications permission", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_user_ids: [recipientId],
          title: "Test",
          message: "Test message",
          notification_type: "info",
        });

      expect(response.status).toBe(403);
    });

    it("should allow authenticated users to send messages", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          recipient_id: recipientId,
          message: "Test message",
        });

      expect(response.status).toBe(201);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/realtime/messages")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it("should handle invalid user ID in presence check", async () => {
      const response = await request(app)
        .get("/api/realtime/users/invalid_id/online")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 400]).toContain(response.status);
    });

    it("should handle non-existent recipients gracefully", async () => {
      const response = await request(app)
        .post("/api/realtime/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipient_user_ids: [999999],
          title: "Test",
          message: "Test message",
          notification_type: "info",
        });

      expect(response.status).toBe(201);
    });
  });
});
