/**
 * User Management Tests
 * Tests for RBAC, user creation, role assignment, and user management endpoints
 */

const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const { signToken } = require("../src/middleware/auth");
const bcrypt = require("bcrypt");

describe("User Management (RBAC)", () => {
  let superAdminToken;
  let adminToken;
  let developerToken;
  let superAdminId;
  let adminId;
  let developerId;
  let testUserId;

  beforeAll(async () => {
    // Create test users with different roles
    const superAdminPassword = await bcrypt.hash("password123", 10);
    const adminPassword = await bcrypt.hash("password123", 10);
    const developerPassword = await bcrypt.hash("password123", 10);

    // Create Super Admin
    const superAdminResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ["superadmin@test.com", superAdminPassword, "Super", "Admin"]
    );
    superAdminId = superAdminResult.insertId;

    // Assign super_admin role
    await db.query(
      `INSERT INTO user_roles (user_id, role, assigned_by)
       VALUES (?, 'super_admin', ?)`,
      [superAdminId, superAdminId]
    );

    // Create Admin
    const adminResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ["admin@test.com", adminPassword, "Admin", "User"]
    );
    adminId = adminResult.insertId;

    // Assign admin role
    await db.query(
      `INSERT INTO user_roles (user_id, role, assigned_by)
       VALUES (?, 'admin', ?)`,
      [adminId, superAdminId]
    );

    // Create Developer
    const developerResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ["developer@test.com", developerPassword, "Dev", "User"]
    );
    developerId = developerResult.insertId;

    // Assign developer role
    await db.query(
      `INSERT INTO user_roles (user_id, role, assigned_by)
       VALUES (?, 'developer', ?)`,
      [developerId, superAdminId]
    );

    // Generate tokens
    superAdminToken = signToken({ id: superAdminId, email: "superadmin@test.com", role: "super_admin" });
    adminToken = signToken({ id: adminId, email: "admin@test.com", role: "admin" });
    developerToken = signToken({ id: developerId, email: "developer@test.com", role: "developer" });
  });

  afterAll(async () => {
    // Clean up test data
    await db.query("DELETE FROM user_roles WHERE user_id IN (?, ?, ?, ?)", [
      superAdminId,
      adminId,
      developerId,
      testUserId,
    ]);
    await db.query("DELETE FROM users WHERE id IN (?, ?, ?, ?)", [superAdminId, adminId, developerId, testUserId]);
  });

  describe("POST /api/users - Create User", () => {
    it("should create a new user with roles (Super Admin only)", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "newuser@test.com",
          password: "password123",
          first_name: "New",
          last_name: "User",
          phone: "1234567890",
          roles: ["developer", "support"],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe("newuser@test.com");
      expect(response.body.data.roles).toContain("developer");
      expect(response.body.data.roles).toContain("support");

      testUserId = response.body.data.id;
    });

    it("should reject user creation by non-Super Admin", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: "another@test.com",
          password: "password123",
          first_name: "Another",
          last_name: "User",
          roles: ["developer"],
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should reject duplicate email", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "newuser@test.com",
          password: "password123",
          first_name: "Duplicate",
          last_name: "User",
          roles: ["developer"],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject invalid email format", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "invalid-email",
          password: "password123",
          first_name: "Invalid",
          last_name: "Email",
          roles: ["developer"],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject invalid role", async () => {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          email: "validuser@test.com",
          password: "password123",
          first_name: "Valid",
          last_name: "User",
          roles: ["invalid_role"],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/users - List Users", () => {
    it("should list all users with pagination", async () => {
      const response = await request(app)
        .get("/api/users?page=1&limit=10")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
    });

    it("should filter users by status", async () => {
      const response = await request(app)
        .get("/api/users?status=active")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((user) => {
        expect(user.status).toBe("active");
      });
    });

    it("should filter users by role", async () => {
      const response = await request(app)
        .get("/api/users?role=developer")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((user) => {
        expect(user.roles).toContain("developer");
      });
    });

    it("should search users by email", async () => {
      const response = await request(app)
        .get("/api/users?search=newuser")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.some((u) => u.email.includes("newuser"))).toBe(true);
    });
  });

  describe("GET /api/users/:id - Get User Details", () => {
    it("should get user details with roles", async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
      expect(Array.isArray(response.body.data.roles)).toBe(true);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .get("/api/users/99999")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/users/:id - Update User Profile", () => {
    it("should update own profile", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          first_name: "Updated",
          last_name: "Name",
          phone: "9876543210",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe("Updated");
      expect(response.body.data.last_name).toBe("Name");
    });

    it("should allow Super Admin to update any user", async () => {
      const response = await request(app)
        .put(`/api/users/${developerId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          first_name: "AdminUpdated",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject non-owner from updating other users", async () => {
      const response = await request(app)
        .put(`/api/users/${superAdminId}`)
        .set("Authorization", `Bearer ${developerToken}`)
        .send({
          first_name: "Hacker",
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/users/:id/roles - Update User Roles", () => {
    it("should update user roles (Super Admin only)", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          roles: ["admin", "finance"],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.roles).toContain("admin");
      expect(response.body.data.roles).toContain("finance");
    });

    it("should reject role update by non-Super Admin", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          roles: ["developer"],
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should reject invalid role", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          roles: ["invalid_role"],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require at least one role", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          roles: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PUT /api/users/:id/status - Update User Status", () => {
    it("should update user status (Super Admin only)", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/status`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "suspended",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("suspended");
    });

    it("should reject invalid status", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/status`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          status: "invalid_status",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject status update by non-Super Admin", async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "inactive",
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /api/users/:id - Delete User", () => {
    it("should soft-delete user (Super Admin only)", async () => {
      // Create a user to delete
      const deleteUserResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        ["deleteuser@test.com", await bcrypt.hash("password123", 10), "Delete", "User"]
      );
      const deleteUserId = deleteUserResult.insertId;

      const response = await request(app)
        .delete(`/api/users/${deleteUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft delete
      const deletedUser = await db.query("SELECT deleted_at FROM users WHERE id = ?", [deleteUserId]);
      expect(deletedUser[0].deleted_at).not.toBeNull();
    });

    it("should reject deletion by non-Super Admin", async () => {
      const response = await request(app)
        .delete(`/api/users/${developerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should prevent Super Admin from deleting self", async () => {
      const response = await request(app)
        .delete(`/api/users/${superAdminId}`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/users/:id/audit - Get User Audit Log", () => {
    it("should get user audit log with pagination", async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}/audit?page=1&limit=10`)
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.page).toBe(1);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .get("/api/users/99999/audit")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/users/search - Search Users", () => {
    it("should search users by query", async () => {
      const response = await request(app)
        .get("/api/users/search?q=newuser&page=1&limit=10")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should filter search results by role", async () => {
      const response = await request(app)
        .get("/api/users/search?role=developer&page=1&limit=10")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should filter search results by status", async () => {
      const response = await request(app)
        .get("/api/users/search?status=active&page=1&limit=10")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("RBAC Permission Checking", () => {
    it("should enforce role-based access control", async () => {
      // Developer should not be able to create users
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${developerToken}`)
        .send({
          email: "test@test.com",
          password: "password123",
          roles: ["developer"],
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should allow Super Admin all operations", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should allow Admin to list users", async () => {
      const response = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
