/**
 * Password Vault Controller Tests
 * Comprehensive test suite for encrypted credential storage
 */

const assert = require("assert");
const db = require("../src/config/db");
const vault = require("../src/controllers/password_vault.controller");

// Mock request and response objects
const mockReq = (userId = 1, body = {}, params = {}, query = {}) => ({
  user: { id: userId },
  body,
  params,
  query,
  ip: "127.0.0.1",
  get: () => "test-agent",
  connection: { remoteAddress: "127.0.0.1" },
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
};

const mockNext = (err) => {
  if (err) throw err;
};

describe("Password Vault Controller", () => {
  // Setup: Create test user before running tests
  before(async () => {
    try {
      // Ensure test user exists
      const userCheck = await db.query("SELECT id FROM users WHERE id = 1 LIMIT 1");
      if (userCheck.length === 0) {
        await db.query(
          `INSERT INTO users (id, email, password_hash, first_name, status) 
           VALUES (1, 'test@vault.com', 'hash', 'Test', 'active')`
        );
      }
    } catch (error) {
      console.error("Setup error:", error);
    }
  });

  // Cleanup: Remove test data after running tests
  after(async () => {
    try {
      await db.query("DELETE FROM password_vault WHERE owner_id = 1");
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Create vault entry", () => {
    it("should create a new vault entry with encrypted password", async () => {
      const req = mockReq(1, {
        credential_type: "api_key",
        label: "Github API",
        username: "github_user",
        password: "secret_api_key_12345",
      });
      const res = mockRes();

      await vault.create(req, res, mockNext);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.vault_id);
      assert.strictEqual(res.jsonData.data.label, "Github API");
      assert.strictEqual(res.jsonData.data.status, "active");
    });

    it("should validate credential_type is required", async () => {
      const req = mockReq(1, {
        label: "Test",
        username: "user",
        password: "pass",
      });
      const res = mockRes();

      await vault.create(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should validate password is required", async () => {
      const req = mockReq(1, {
        credential_type: "database",
        label: "Production DB",
        username: "dbuser",
      });
      const res = mockRes();

      await vault.create(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should validate label is required", async () => {
      const req = mockReq(1, {
        credential_type: "smtp",
        username: "smtp_user",
        password: "smtp_pass",
      });
      const res = mockRes();

      await vault.create(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should reject password with max length", async () => {
      const longPassword = "x".repeat(1001);
      const req = mockReq(1, {
        credential_type: "api_key",
        label: "Test",
        username: "user",
        password: longPassword,
      });
      const res = mockRes();

      await vault.create(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });
  });

  describe("Get vault entry", () => {
    let vaultId;

    before(async () => {
      // Create test vault entry
      const req = mockReq(1, {
        credential_type: "database",
        label: "MySQL Dev",
        username: "dev_user",
        password: "dev_password_secure",
      });
      const res = mockRes();
      await vault.create(req, res, mockNext);
      vaultId = res.jsonData.data.vault_id;
    });

    it("should retrieve vault entry with decrypted password", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.vault_id, vaultId);
      assert.strictEqual(res.jsonData.data.label, "MySQL Dev");
      assert.strictEqual(res.jsonData.data.password, "dev_password_secure"); // Decrypted
    });

    it("should return 404 for non-existent vault entry", async () => {
      const req = mockReq(1, {}, { id: "VAULT_NONEXISTENT" });
      const res = mockRes();

      await vault.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should not allow access to other user's vault entry", async () => {
      const req = mockReq(999, {}, { id: vaultId }); // Different user
      const res = mockRes();

      await vault.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe("List vault entries", () => {
    before(async () => {
      // Create multiple test entries
      const types = [
        { credential_type: "api_key", label: "Stripe API", username: "stripe_user", password: "stripe_secret" },
        { credential_type: "database", label: "Prod DB", username: "admin", password: "prod_pass" },
        { credential_type: "api_key", label: "AWS Key", username: "aws_user", password: "aws_secret" },
        { credential_type: "smtp", label: "Email SMTP", username: "smtp@example.com", password: "smtp_password" },
      ];

      for (const cred of types) {
        const req = mockReq(1, cred);
        const res = mockRes();
        await vault.create(req, res, mockNext);
      }
    });

    it("should list all vault entries for user", async () => {
      const req = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.length > 0);
      assert.ok(res.jsonData.pagination);
    });

    it("should filter by credential_type", async () => {
      const req = mockReq(1, {}, {}, { credential_type: "api_key", limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      const allApiKeys = res.jsonData.data.every((item) => item.credential_type === "api_key");
      assert.strictEqual(allApiKeys, true);
    });

    it("should filter by label", async () => {
      const req = mockReq(1, {}, {}, { label: "Stripe", limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData.data.some((item) => item.label.includes("Stripe")));
    });

    it("should filter by status", async () => {
      const req = mockReq(1, {}, {}, { status: "active", limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      const allActive = res.jsonData.data.every((item) => item.status === "active");
      assert.strictEqual(allActive, true);
    });

    it("should support pagination", async () => {
      const req = mockReq(1, {}, {}, { limit: 2, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData.pagination.limit === 2 || res.jsonData.data.length <= 2);
      assert.strictEqual(res.jsonData.pagination.offset, 0);
    });

    it("should not expose encrypted passwords in list", async () => {
      const req = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      res.jsonData.data.forEach((item) => {
        assert.ok(!item.encrypted_password);
        assert.ok(!item.password);
      });
    });
  });

  describe("Update vault entry", () => {
    let vaultId;

    before(async () => {
      const req = mockReq(1, {
        credential_type: "api_key",
        label: "Original Label",
        username: "original_user",
        password: "original_pass",
      });
      const res = mockRes();
      await vault.create(req, res, mockNext);
      vaultId = res.jsonData.data.vault_id;
    });

    it("should update password", async () => {
      const req = mockReq(1, { password: "new_secure_password" }, { id: vaultId });
      const res = mockRes();

      await vault.update(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      // Verify password was updated
      const getReq = mockReq(1, {}, { id: vaultId });
      const getRes = mockRes();
      await vault.get(getReq, getRes, mockNext);
      assert.strictEqual(getRes.jsonData.data.password, "new_secure_password");
    });

    it("should update label", async () => {
      const req = mockReq(1, { label: "Updated Label" }, { id: vaultId });
      const res = mockRes();

      await vault.update(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
    });

    it("should update status", async () => {
      const req = mockReq(1, { status: "archived" }, { id: vaultId });
      const res = mockRes();

      await vault.update(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
    });

    it("should reject invalid status", async () => {
      const req = mockReq(1, { status: "invalid" }, { id: vaultId });
      const res = mockRes();

      await vault.update(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should return 404 for non-existent entry", async () => {
      const req = mockReq(1, { label: "New" }, { id: "VAULT_NONEXISTENT" });
      const res = mockRes();

      await vault.update(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.jsonData.success, false);
    });
  });

  describe("Delete vault entry", () => {
    let vaultId;

    before(async () => {
      const req = mockReq(1, {
        credential_type: "database",
        label: "Deletable Entry",
        username: "user",
        password: "pass",
      });
      const res = mockRes();
      await vault.create(req, res, mockNext);
      vaultId = res.jsonData.data.vault_id;
    });

    it("should soft-delete vault entry", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.remove(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      // Verify it's soft-deleted
      const getReq = mockReq(1, {}, { id: vaultId });
      const getRes = mockRes();
      await vault.get(getReq, getRes, mockNext);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it("should return 404 for non-existent entry", async () => {
      const req = mockReq(1, {}, { id: "VAULT_NONEXISTENT" });
      const res = mockRes();

      await vault.remove(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.jsonData.success, false);
    });
  });

  describe("Archive and restore vault entries", () => {
    let vaultId;

    before(async () => {
      const req = mockReq(1, {
        credential_type: "api_key",
        label: "Archive Test",
        username: "user",
        password: "pass",
      });
      const res = mockRes();
      await vault.create(req, res, mockNext);
      vaultId = res.jsonData.data.vault_id;
    });

    it("should archive active vault entry", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.archive(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      // Verify status is archived
      const listReq = mockReq(1, {}, {}, { status: "archived", limit: 10, offset: 0 });
      const listRes = mockRes();
      await vault.list(listReq, listRes, mockNext);
      assert.ok(listRes.jsonData.data.some((item) => item.vault_id === vaultId));
    });

    it("should not allow archiving already archived entry", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.archive(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should restore archived vault entry", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.restore(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      // Verify status is active
      const listReq = mockReq(1, {}, {}, { status: "active", limit: 10, offset: 0 });
      const listRes = mockRes();
      await vault.list(listReq, listRes, mockNext);
      assert.ok(listRes.jsonData.data.some((item) => item.vault_id === vaultId));
    });

    it("should not allow restoring already active entry", async () => {
      const req = mockReq(1, {}, { id: vaultId });
      const res = mockRes();

      await vault.restore(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
    });
  });

  describe("Vault statistics", () => {
    it("should get vault statistics", async () => {
      const req = mockReq(1);
      const res = mockRes();

      await vault.getStats(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data);
      assert.ok("total" in res.jsonData.data);
      assert.ok("active_count" in res.jsonData.data);
      assert.ok("archived_count" in res.jsonData.data);
    });
  });

  describe("Data isolation", () => {
    it("should only show entries for authenticated user", async () => {
      const user1Req = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const user1Res = mockRes();

      await vault.list(user1Req, user1Res, mockNext);

      const user1Count = user1Res.jsonData.pagination.total;

      // Create entry as different user
      const user2Req = mockReq(2, {
        credential_type: "api_key",
        label: "User 2 Entry",
        username: "user2",
        password: "user2_pass",
      });
      const user2CreateRes = mockRes();
      await vault.create(user2Req, user2CreateRes, mockNext);

      // List as user 1 again
      const user1Req2 = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const user1Res2 = mockRes();
      await vault.list(user1Req2, user1Res2, mockNext);

      // Count should not have changed
      assert.strictEqual(user1Res2.jsonData.pagination.total, user1Count);
    });
  });

  describe("Encryption verification", () => {
    it("should not expose encrypted password in list response", async () => {
      const req = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const res = mockRes();

      await vault.list(req, res, mockNext);

      res.jsonData.data.forEach((item) => {
        assert.ok(!item.encrypted_password || !item.encrypted_password.includes("|"));
      });
    });

    it("should decrypt password correctly on retrieval", async () => {
      const originalPassword = "test_encryption_password_12345";
      const createReq = mockReq(1, {
        credential_type: "test",
        label: "Encryption Test",
        username: "test_user",
        password: originalPassword,
      });
      const createRes = mockRes();
      await vault.create(createReq, createRes, mockNext);
      const vaultId = createRes.jsonData.data.vault_id;

      const getReq = mockReq(1, {}, { id: vaultId });
      const getRes = mockRes();
      await vault.get(getReq, getRes, mockNext);

      assert.strictEqual(getRes.jsonData.data.password, originalPassword);
    });
  });
});
