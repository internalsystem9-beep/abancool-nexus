/**
 * User Management Unit Tests
 * Tests for RBAC, user creation, role assignment, and user management logic
 */

const assert = require("assert");
const db = require("../src/config/db");
const bcrypt = require("bcrypt");
const { signToken } = require("../src/middleware/auth");
const { checkPermission, getUserPermissions } = require("../src/middleware/rbac");

describe("User Management (RBAC) - Unit Tests", () => {
  let testUserId;
  let superAdminId;

  before(async () => {
    // Create test super admin user
    const superAdminPassword = await bcrypt.hash("password123", 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ["superadmin@test.com", superAdminPassword, "Super", "Admin"]
    );
    superAdminId = result.insertId;

    // Assign super_admin role
    await db.query(
      `INSERT INTO user_roles (user_id, role, assigned_by)
       VALUES (?, 'super_admin', ?)`,
      [superAdminId, superAdminId]
    );
  });

  after(async () => {
    // Clean up test data
    if (testUserId) {
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [testUserId]);
      await db.query("DELETE FROM users WHERE id = ?", [testUserId]);
    }
    await db.query("DELETE FROM user_roles WHERE user_id = ?", [superAdminId]);
    await db.query("DELETE FROM users WHERE id = ?", [superAdminId]);
  });

  describe("User Creation", () => {
    it("should create a user with valid data", async () => {
      const email = `testuser${Date.now()}@test.com`;
      const password = "password123";
      const passwordHash = await bcrypt.hash(password, 10);

      const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Test", "User"]
      );

      testUserId = result.insertId;

      assert(testUserId > 0, "User ID should be positive");

      // Verify user was created
      const users = await db.query("SELECT * FROM users WHERE id = ?", [testUserId]);
      assert.strictEqual(users.length, 1, "User should exist");
      assert.strictEqual(users[0].email, email, "Email should match");
      assert.strictEqual(users[0].first_name, "Test", "First name should match");
    });

    it("should hash password correctly", async () => {
      const password = "securepassword123";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      assert(isValid, "Password should match hash");

      const isInvalid = await bcrypt.compare("wrongpassword", hash);
      assert(!isInvalid, "Wrong password should not match");
    });
  });

  describe("Role Assignment", () => {
    it("should assign role to user", async () => {
      const email = `roleuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Role", "User"]
      );
      const userId = userResult.insertId;

      // Assign role
      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, 'developer', ?)`,
        [userId, superAdminId]
      );

      // Verify role was assigned
      const roles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
      assert.strictEqual(roles.length, 1, "User should have one role");
      assert.strictEqual(roles[0].role, "developer", "Role should be developer");

      // Clean up
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("should support multiple roles per user", async () => {
      const email = `multiroleuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Multi", "Role"]
      );
      const userId = userResult.insertId;

      // Assign multiple roles
      const roles = ["developer", "support", "finance"];
      for (const role of roles) {
        await db.query(
          `INSERT INTO user_roles (user_id, role, assigned_by)
           VALUES (?, ?, ?)`,
          [userId, role, superAdminId]
        );
      }

      // Verify all roles were assigned
      const userRoles = await db.query("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
      assert.strictEqual(userRoles.length, 3, "User should have three roles");
      const roleNames = userRoles.map((r) => r.role);
      assert(roleNames.includes("developer"), "Should have developer role");
      assert(roleNames.includes("support"), "Should have support role");
      assert(roleNames.includes("finance"), "Should have finance role");

      // Clean up
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("should prevent duplicate role assignment", async () => {
      const email = `dupuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Dup", "User"]
      );
      const userId = userResult.insertId;

      // Assign role
      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, 'developer', ?)`,
        [userId, superAdminId]
      );

      // Try to assign same role again - should fail due to unique constraint
      try {
        await db.query(
          `INSERT INTO user_roles (user_id, role, assigned_by)
           VALUES (?, 'developer', ?)`,
          [userId, superAdminId]
        );
        assert.fail("Should not allow duplicate role");
      } catch (error) {
        assert(error.message.includes("Duplicate"), "Should be duplicate key error");
      }

      // Clean up
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });
  });

  describe("RBAC Permission Checking", () => {
    it("should check permission for super_admin role", async () => {
      const hasPermission = await checkPermission(superAdminId, "create_user");
      assert(hasPermission, "Super admin should have create_user permission");
    });

    it("should deny permission for unauthorized role", async () => {
      const email = `devuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Dev", "User"]
      );
      const userId = userResult.insertId;

      // Assign developer role
      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, 'developer', ?)`,
        [userId, superAdminId]
      );

      // Developer should not have create_user permission
      const hasPermission = await checkPermission(userId, "create_user");
      assert(!hasPermission, "Developer should not have create_user permission");

      // Clean up
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("should get all permissions for a user", async () => {
      const permissions = await getUserPermissions(superAdminId);
      assert(Array.isArray(permissions), "Should return array of permissions");
      assert(permissions.length > 0, "Super admin should have permissions");
      assert(permissions.includes("create_user"), "Should include create_user");
      assert(permissions.includes("manage_system"), "Should include manage_system");
    });

    it("should get limited permissions for developer role", async () => {
      const email = `devuser2${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Dev", "User"]
      );
      const userId = userResult.insertId;

      // Assign developer role
      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, 'developer', ?)`,
        [userId, superAdminId]
      );

      const permissions = await getUserPermissions(userId);
      assert(Array.isArray(permissions), "Should return array of permissions");
      assert(permissions.includes("read_projects"), "Should have read_projects");
      assert(!permissions.includes("create_user"), "Should not have create_user");

      // Clean up
      await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });
  });

  describe("User Status Management", () => {
    it("should update user status", async () => {
      const email = `statususer${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Status", "User"]
      );
      const userId = userResult.insertId;

      // Update status
      await db.query("UPDATE users SET status = ? WHERE id = ?", ["suspended", userId]);

      // Verify status was updated
      const users = await db.query("SELECT status FROM users WHERE id = ?", [userId]);
      assert.strictEqual(users[0].status, "suspended", "Status should be suspended");

      // Clean up
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("should support all valid statuses", async () => {
      const email = `statususer2${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Status", "User"]
      );
      const userId = userResult.insertId;

      const statuses = ["active", "inactive", "suspended"];
      for (const status of statuses) {
        await db.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
        const users = await db.query("SELECT status FROM users WHERE id = ?", [userId]);
        assert.strictEqual(users[0].status, status, `Status should be ${status}`);
      }

      // Clean up
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });
  });

  describe("Soft Delete", () => {
    it("should soft-delete user", async () => {
      const email = `deleteuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Delete", "User"]
      );
      const userId = userResult.insertId;

      // Soft delete
      await db.query("UPDATE users SET deleted_at = NOW() WHERE id = ?", [userId]);

      // Verify soft delete
      const users = await db.query("SELECT deleted_at FROM users WHERE id = ?", [userId]);
      assert(users[0].deleted_at !== null, "deleted_at should be set");

      // Verify user is excluded from active queries
      const activeUsers = await db.query("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
      assert.strictEqual(activeUsers.length, 0, "Soft-deleted user should not appear in active queries");

      // Clean up
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });
  });

  describe("Audit Logging", () => {
    it("should log user creation", async () => {
      const email = `audituser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Audit", "User"]
      );
      const userId = userResult.insertId;

      // Log audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status)
         VALUES (?, 'user_created', 'users', ?, 'success')`,
        [superAdminId, userId]
      );

      // Verify audit log
      const logs = await db.query("SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'user_created'", [
        userId,
      ]);
      assert(logs.length > 0, "Audit log should exist");
      assert.strictEqual(logs[0].action, "user_created", "Action should be user_created");

      // Clean up
      await db.query("DELETE FROM audit_logs WHERE resource_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });

    it("should track old and new values in audit log", async () => {
      const email = `audituser2${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Old", "Name"]
      );
      const userId = userResult.insertId;

      const oldValues = { first_name: "Old" };
      const newValues = { first_name: "New" };

      // Log audit with old and new values
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, status)
         VALUES (?, 'user_updated', 'users', ?, ?, ?, 'success')`,
        [superAdminId, userId, JSON.stringify(oldValues), JSON.stringify(newValues)]
      );

      // Verify audit log
      const logs = await db.query("SELECT * FROM audit_logs WHERE resource_id = ? AND action = 'user_updated'", [
        userId,
      ]);
      assert(logs.length > 0, "Audit log should exist");
      const parsedOldValues = JSON.parse(logs[0].old_values);
      const parsedNewValues = JSON.parse(logs[0].new_values);
      assert.strictEqual(parsedOldValues.first_name, "Old", "Old value should be tracked");
      assert.strictEqual(parsedNewValues.first_name, "New", "New value should be tracked");

      // Clean up
      await db.query("DELETE FROM audit_logs WHERE resource_id = ?", [userId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
    });
  });

  describe("User-Client Assignment", () => {
    it("should create user-client relationship", async () => {
      // Create test client
      const clientResult = await db.query(
        `INSERT INTO clients (client_id, company_name, email, status)
         VALUES (?, ?, ?, 'active')`,
        [`CLIENT-${Date.now()}`, "Test Company", "company@test.com"]
      );
      const clientId = clientResult.insertId;

      // Create test user
      const email = `clientuser${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);
      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Client", "User"]
      );
      const userId = userResult.insertId;

      // Assign user to client
      await db.query(
        `INSERT INTO user_clients (user_id, client_id, assigned_at)
         VALUES (?, ?, NOW())`,
        [userId, clientId]
      );

      // Verify assignment
      const assignments = await db.query("SELECT * FROM user_clients WHERE user_id = ? AND client_id = ?", [
        userId,
        clientId,
      ]);
      assert.strictEqual(assignments.length, 1, "Assignment should exist");

      // Clean up
      await db.query("DELETE FROM user_clients WHERE user_id = ? AND client_id = ?", [userId, clientId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
      await db.query("DELETE FROM clients WHERE id = ?", [clientId]);
    });

    it("should prevent duplicate user-client assignments", async () => {
      // Create test client
      const clientResult = await db.query(
        `INSERT INTO clients (client_id, company_name, email, status)
         VALUES (?, ?, ?, 'active')`,
        [`CLIENT-${Date.now()}`, "Test Company", "company@test.com"]
      );
      const clientId = clientResult.insertId;

      // Create test user
      const email = `clientuser2${Date.now()}@test.com`;
      const passwordHash = await bcrypt.hash("password123", 10);
      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [email, passwordHash, "Client", "User"]
      );
      const userId = userResult.insertId;

      // Assign user to client
      await db.query(
        `INSERT INTO user_clients (user_id, client_id, assigned_at)
         VALUES (?, ?, NOW())`,
        [userId, clientId]
      );

      // Try to assign again - should fail
      try {
        await db.query(
          `INSERT INTO user_clients (user_id, client_id, assigned_at)
           VALUES (?, ?, NOW())`,
          [userId, clientId]
        );
        assert.fail("Should not allow duplicate assignment");
      } catch (error) {
        assert(error.message.includes("Duplicate"), "Should be duplicate key error");
      }

      // Clean up
      await db.query("DELETE FROM user_clients WHERE user_id = ? AND client_id = ?", [userId, clientId]);
      await db.query("DELETE FROM users WHERE id = ?", [userId]);
      await db.query("DELETE FROM clients WHERE id = ?", [clientId]);
    });
  });

  describe("Token Generation", () => {
    it("should generate valid JWT token", () => {
      const payload = { id: superAdminId, email: "superadmin@test.com", role: "super_admin" };
      const token = signToken(payload);

      assert(typeof token === "string", "Token should be a string");
      assert(token.split(".").length === 3, "Token should have 3 parts (JWT format)");
    });
  });
});
