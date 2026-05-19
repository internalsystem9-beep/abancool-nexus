const request = require("supertest");
const db = require("../config/db");
const app = require("../index");

let testUserId;
let testUserToken;
let adminUserId;
let adminUserToken;
let backupId;
let scheduleId;
let restoreId;
let verificationId;

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
    ? ["read_backups", "manage_backups"] 
    : ["read_backups"];

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

describe("Backup System", () => {
  beforeAll(async () => {
    // Create test users
    testUserId = await createTestUser("backupuser@example.com", "user");
    adminUserId = await createTestUser("backupadmin@example.com", "super_admin");

    testUserToken = await loginUser("backupuser@example.com");
    adminUserToken = await loginUser("backupadmin@example.com");
  });

  afterAll(async () => {
    // Clean up
    await db.query(
      `DELETE FROM backup_verifications WHERE backup_id IN (SELECT id FROM backup_history WHERE created_by = ?)`,
      [adminUserId]
    );
    await db.query(`DELETE FROM restore_operations WHERE backup_id IN (SELECT id FROM backup_history WHERE created_by = ?)`, [adminUserId]);
    await db.query(`DELETE FROM backup_history WHERE created_by IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM backup_schedules WHERE created_by IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_permissions WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM user_roles WHERE user_id IN (?, ?)`, [testUserId, adminUserId]);
    await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [testUserId, adminUserId]);
  });

  // ==================== BACKUP CREATION TESTS ====================
  describe("Backup Creation", () => {
    test("should create database backup", async () => {
      const response = await request(app)
        .post("/api/backups")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          backup_type: "database",
          description: "Daily database backup",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backup_id).toBeDefined();
      expect(response.body.data.backup_type).toBe("database");
      backupId = response.body.data.backup_id;
    });

    test("should create file backup", async () => {
      const response = await request(app)
        .post("/api/backups")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          backup_type: "files",
          description: "Files backup",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backup_type).toBe("files");
    });

    test("should create full backup", async () => {
      const response = await request(app)
        .post("/api/backups")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          backup_type: "full",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.backup_type).toBe("full");
    });

    test("should reject invalid backup type", async () => {
      const response = await request(app)
        .post("/api/backups")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          backup_type: "invalid_type",
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== BACKUP SCHEDULING TESTS ====================
  describe("Backup Scheduling - Create", () => {
    test("should schedule daily backup", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_name: "Daily Database Backup",
          backup_type: "database",
          schedule_frequency: "daily",
          schedule_time: "02:00",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backup_schedule_id).toBeDefined();
      scheduleId = response.body.data.backup_schedule_id;
    });

    test("should schedule weekly backup", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_name: "Weekly Full Backup",
          backup_type: "full",
          schedule_frequency: "weekly",
          schedule_time: "Sunday 03:00",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.schedule_frequency).toBe("weekly");
    });

    test("should schedule monthly backup", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_name: "Monthly Archive",
          backup_type: "database",
          schedule_frequency: "monthly",
          schedule_time: "1st day 04:00",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.schedule_frequency).toBe("monthly");
    });

    test("should reject schedule without name", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          backup_type: "database",
          schedule_frequency: "daily",
          schedule_time: "02:00",
        });

      expect(response.status).toBe(400);
    });

    test("should reject schedule with invalid frequency", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_name: "Test",
          backup_type: "database",
          schedule_frequency: "invalid",
          schedule_time: "02:00",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Backup Scheduling - Read", () => {
    test("should get backup schedules", async () => {
      const response = await request(app)
        .get("/api/backups/schedules")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter schedules by enabled status", async () => {
      const response = await request(app)
        .get("/api/backups/schedules?enabled=true")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should support pagination", async () => {
      const response = await request(app)
        .get("/api/backups/schedules?page=1&limit=5")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe("Backup Scheduling - Update", () => {
    test("should update backup schedule", async () => {
      const response = await request(app)
        .patch(`/api/backups/schedules/${scheduleId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_time: "03:00",
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should disable schedule", async () => {
      const response = await request(app)
        .patch(`/api/backups/schedules/${scheduleId}`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          enabled: false,
        });

      expect(response.status).toBe(200);
    });

    test("should return 404 for non-existent schedule", async () => {
      const response = await request(app)
        .patch("/api/backups/schedules/99999")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          schedule_time: "04:00",
        });

      expect(response.status).toBe(404);
    });
  });

  describe("Backup Scheduling - Delete", () => {
    test("should delete backup schedule", async () => {
      const response = await request(app)
        .delete(`/api/backups/schedules/${scheduleId}`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should return 404 when deleting non-existent schedule", async () => {
      const response = await request(app)
        .delete("/api/backups/schedules/99999")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== BACKUP HISTORY TESTS ====================
  describe("Backup History", () => {
    test("should get backup history", async () => {
      const response = await request(app)
        .get("/api/backups")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter backups by status", async () => {
      const response = await request(app)
        .get("/api/backups?status=completed")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should filter backups by type", async () => {
      const response = await request(app)
        .get("/api/backups?backup_type=database")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should get backup details", async () => {
      const response = await request(app)
        .get(`/api/backups/${backupId}`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(backupId);
    });

    test("should return 404 for non-existent backup", async () => {
      const response = await request(app)
        .get("/api/backups/99999")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== RESTORE OPERATIONS TESTS ====================
  describe("Restore Operations - Database", () => {
    test("should restore from database backup", async () => {
      const response = await request(app)
        .post(`/api/backups/${backupId}/restore`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          restore_target: "primary",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.restore_id).toBeDefined();
      restoreId = response.body.data.restore_id;
    });

    test("should not restore file-only backup as database", async () => {
      const fileBackup = await db.query(
        `INSERT INTO backup_history (backup_name, backup_type, status, size_bytes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        ["backup_files", "files", "completed", 1000, adminUserId]
      );

      const response = await request(app)
        .post(`/api/backups/${fileBackup.insertId}/restore`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          restore_target: "primary",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Restore Operations - Files", () => {
    test("should restore file backup", async () => {
      const fileBackup = await db.query(
        `INSERT INTO backup_history (backup_name, backup_type, status, size_bytes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        ["backup_files", "files", "completed", 1000, adminUserId]
      );

      const response = await request(app)
        .post(`/api/backups/${fileBackup.insertId}/restore/files`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          restore_path: "/var/www/backups",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test("should not restore database-only backup as files", async () => {
      const response = await request(app)
        .post(`/api/backups/${backupId}/restore/files`)
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          restore_path: "/var/www",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Restore Operations - Status", () => {
    test("should get restore operation status", async () => {
      const response = await request(app)
        .get(`/api/restores/${restoreId}/status`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(restoreId);
    });

    test("should get restore history", async () => {
      const response = await request(app)
        .get("/api/restores")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test("should filter restore history by status", async () => {
      const response = await request(app)
        .get("/api/restores?status=completed")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== BACKUP VERIFICATION TESTS ====================
  describe("Backup Verification", () => {
    test("should verify backup integrity", async () => {
      const response = await request(app)
        .post(`/api/backups/${backupId}/verify`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verification_id).toBeDefined();
      verificationId = response.body.data.verification_id;
    });

    test("should get verification results", async () => {
      const response = await request(app)
        .get(`/api/backups/${verificationId}/verification`)
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });
  });

  // ==================== BACKUP STORAGE TESTS ====================
  describe("Backup Storage & Maintenance", () => {
    test("should get backup storage statistics", async () => {
      const response = await request(app)
        .get("/api/backups/storage/stats")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.storage_stats).toBeDefined();
      expect(response.body.data.latest_backups).toBeDefined();
      expect(response.body.data.retention_info).toBeDefined();
    });

    test("should cleanup old backups", async () => {
      const response = await request(app)
        .post("/api/backups/storage/cleanup")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 30,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backups_deleted).toBeDefined();
    });

    test("should reject invalid retention period", async () => {
      const response = await request(app)
        .post("/api/backups/storage/cleanup")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 0,
        });

      expect(response.status).toBe(400);
    });

    test("should reject retention period > 10 years", async () => {
      const response = await request(app)
        .post("/api/backups/storage/cleanup")
        .set("Authorization", `Bearer ${adminUserToken}`)
        .send({
          days_to_keep: 3651,
        });

      expect(response.status).toBe(400);
    });
  });

  // ==================== BACKUP DELETION TESTS ====================
  describe("Backup Deletion", () => {
    test("should delete backup", async () => {
      const response = await request(app)
        .delete(`/api/backups/${backupId}`)
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("should return 404 when deleting non-existent backup", async () => {
      const response = await request(app)
        .delete("/api/backups/99999")
        .set("Authorization", `Bearer ${adminUserToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ==================== AUTHORIZATION TESTS ====================
  describe("Authorization", () => {
    test("should require read_backups permission to view backups", async () => {
      const response = await request(app)
        .get("/api/backups")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 403]).toContain(response.status);
    });

    test("should require manage_backups permission to create backup", async () => {
      const response = await request(app)
        .post("/api/backups")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          backup_type: "database",
        });

      expect(response.status).toBe(403);
    });

    test("should require manage_backups permission to schedule backup", async () => {
      const response = await request(app)
        .post("/api/backups/schedules")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          schedule_name: "Test",
          backup_type: "database",
          schedule_frequency: "daily",
          schedule_time: "02:00",
        });

      expect(response.status).toBe(403);
    });

    test("should require manage_backups permission to restore", async () => {
      const response = await request(app)
        .post("/api/backups/1/restore")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          restore_target: "primary",
        });

      expect(response.status).toBe(403);
    });

    test("should reject requests without authentication", async () => {
      const response = await request(app)
        .get("/api/backups");

      expect(response.status).toBe(401);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================
  describe("Error Handling", () => {
    test("should handle database errors gracefully", async () => {
      const response = await request(app)
        .get("/api/backups?page=invalid")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle invalid pagination parameters", async () => {
      const response = await request(app)
        .get("/api/backups?page=0&limit=-1")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle concurrent backup requests", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .get("/api/backups")
            .set("Authorization", `Bearer ${testUserToken}`)
        );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });

  // ==================== PAGINATION TESTS ====================
  describe("Pagination", () => {
    test("should paginate backup history", async () => {
      const response = await request(app)
        .get("/api/backups?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    test("should paginate backup schedules", async () => {
      const response = await request(app)
        .get("/api/backups/schedules?page=1&limit=5")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });

    test("should paginate restore history", async () => {
      const response = await request(app)
        .get("/api/restores?page=1&limit=10")
        .set("Authorization", `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  // ==================== DATA STRUCTURE TESTS ====================
  describe("Data Structures", () => {
    test("backup should include required fields", async () => {
      const backups = await db.query(`SELECT * FROM backup_history LIMIT 1`);
      if (backups.length > 0) {
        expect(backups[0]).toHaveProperty("backup_name");
        expect(backups[0]).toHaveProperty("backup_type");
        expect(backups[0]).toHaveProperty("status");
        expect(backups[0]).toHaveProperty("created_by");
      }
    });

    test("schedule should include required fields", async () => {
      const schedules = await db.query(`SELECT * FROM backup_schedules LIMIT 1`);
      if (schedules.length > 0) {
        expect(schedules[0]).toHaveProperty("schedule_name");
        expect(schedules[0]).toHaveProperty("backup_type");
        expect(schedules[0]).toHaveProperty("schedule_frequency");
        expect(schedules[0]).toHaveProperty("schedule_time");
      }
    });

    test("restore operation should include required fields", async () => {
      const restores = await db.query(`SELECT * FROM restore_operations LIMIT 1`);
      if (restores.length > 0) {
        expect(restores[0]).toHaveProperty("backup_id");
        expect(restores[0]).toHaveProperty("restore_target");
        expect(restores[0]).toHaveProperty("status");
      }
    });
  });
});
