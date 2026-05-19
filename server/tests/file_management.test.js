/**
 * File Management Controller Tests
 * Comprehensive test suite for file upload, download, and management
 */

const assert = require("assert");
const db = require("../src/config/db");
const fileManagement = require("../src/controllers/file_management.controller");

// Mock request and response objects
const mockReq = (userId = 1, body = {}, params = {}, query = {}, files = null) => ({
  user: { id: userId },
  body,
  params,
  query,
  files,
  ip: "127.0.0.1",
  get: () => "test-agent",
  connection: { remoteAddress: "127.0.0.1" },
});

const mockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    downloadPath: null,
    downloadName: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
    download: function (path, name) {
      this.downloadPath = path;
      this.downloadName = name;
      return this;
    },
  };
  return res;
};

const mockNext = (err) => {
  if (err) throw err;
};

describe("File Management Controller", () => {
  // Setup: Create test user and project before running tests
  before(async () => {
    try {
      // Ensure test user exists
      const userCheck = await db.query("SELECT id FROM users WHERE id = 1 LIMIT 1");
      if (userCheck.length === 0) {
        await db.query(
          `INSERT INTO users (id, email, password_hash, first_name, status) 
           VALUES (1, 'filetest@example.com', 'hash', 'Test', 'active')`
        );
      }

      // Ensure test project exists
      const projectCheck = await db.query("SELECT id FROM projects WHERE id = 1 LIMIT 1");
      if (projectCheck.length === 0) {
        await db.query(
          `INSERT INTO projects (id, client_id, project_name, status) 
           VALUES (1, NULL, 'Test Project', 'active')`
        );
      }
    } catch (error) {
      console.error("Setup error:", error);
    }
  });

  // Cleanup: Remove test data after running tests
  after(async () => {
    try {
      await db.query("DELETE FROM files WHERE uploaded_by = 1");
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  describe("Upload file", () => {
    it("should upload file with valid data", async () => {
      const mockFile = {
        name: "test-document.pdf",
        data: Buffer.from("PDF content"),
        size: 1024,
        mimetype: "application/pdf",
        mv: async (path) => {
          // Mock file move
        },
      };

      const req = mockReq(
        1,
        { project_id: 1 },
        {},
        {},
        { file: mockFile }
      );
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.file_id);
      assert.ok(res.jsonData.data.download_token);
      assert.strictEqual(res.jsonData.data.original_filename, "test-document.pdf");
    });

    it("should reject upload without file", async () => {
      const req = mockReq(1, { project_id: 1 }, {}, {}, null);
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
      assert.ok(res.jsonData.error.includes("No file provided"));
    });

    it("should validate file size limit", async () => {
      const mockFile = {
        name: "large-file.zip",
        size: 60 * 1024 * 1024, // 60MB (exceeds 50MB limit)
        mimetype: "application/zip",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
      assert.ok(res.jsonData.error.includes("exceeds limit"));
    });

    it("should validate MIME type", async () => {
      const mockFile = {
        name: "malicious.exe",
        size: 1024,
        mimetype: "application/x-msdownload",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.jsonData.success, false);
      assert.ok(res.jsonData.error.includes("not allowed"));
    });

    it("should validate project_id exists", async () => {
      const mockFile = {
        name: "test.pdf",
        size: 1024,
        mimetype: "application/pdf",
        mv: async () => {},
      };

      const req = mockReq(1, { project_id: 99999 }, {}, {}, { file: mockFile });
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.jsonData.success, false);
    });

    it("should support upload without project_id", async () => {
      const mockFile = {
        name: "standalone.txt",
        size: 512,
        mimetype: "text/plain",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();

      await fileManagement.upload(req, res, mockNext);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.project_id, undefined || null);
    });

    it("should accept various allowed MIME types", async () => {
      const allowedTypes = [
        { name: "doc.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        { name: "image.png", mime: "image/png" },
        { name: "data.json", mime: "application/json" },
        { name: "archive.zip", mime: "application/zip" },
      ];

      for (const fileType of allowedTypes) {
        const mockFile = {
          name: fileType.name,
          size: 1024,
          mimetype: fileType.mime,
          mv: async () => {},
        };

        const req = mockReq(1, {}, {}, {}, { file: mockFile });
        const res = mockRes();

        await fileManagement.upload(req, res, mockNext);

        assert.strictEqual(res.statusCode, 201, `Failed for ${fileType.name}`);
        assert.strictEqual(res.jsonData.success, true);
      }
    });
  });

  describe("List files", () => {
    before(async () => {
      // Create test files
      const mockFile = {
        name: "doc1.pdf",
        size: 1024,
        mimetype: "application/pdf",
        mv: async () => {},
      };

      for (let i = 0; i < 3; i++) {
        const req = mockReq(1, { project_id: 1 }, {}, {}, { file: mockFile });
        const res = mockRes();
        await fileManagement.upload(req, res, mockNext);
      }
    });

    it("should list all files for user", async () => {
      const req = mockReq(1, {}, {}, { limit: 10, offset: 0 });
      const res = mockRes();

      await fileManagement.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.length > 0);
      assert.ok(res.jsonData.pagination);
    });

    it("should filter by MIME type", async () => {
      const req = mockReq(1, {}, {}, { mime_type: "application/pdf", limit: 10, offset: 0 });
      const res = mockRes();

      await fileManagement.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      const allPDF = res.jsonData.data.every((f) => f.mime_type === "application/pdf");
      assert.strictEqual(allPDF, true);
    });

    it("should filter by project_id", async () => {
      const req = mockReq(1, {}, {}, { project_id: 1, limit: 10, offset: 0 });
      const res = mockRes();

      await fileManagement.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.jsonData.data.length > 0);
    });

    it("should support pagination", async () => {
      const req = mockReq(1, {}, {}, { limit: 1, offset: 0 });
      const res = mockRes();

      await fileManagement.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.data.length <= 1);
      assert.strictEqual(res.jsonData.pagination.limit, 1);
    });

    it("should not show other user's files", async () => {
      const req = mockReq(999, {}, {}, { limit: 10, offset: 0 });
      const res = mockRes();

      await fileManagement.list(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.pagination.total, 0);
    });
  });

  describe("Get file details", () => {
    let fileId;

    before(async () => {
      const mockFile = {
        name: "details-test.pdf",
        size: 2048,
        mimetype: "application/pdf",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();
      await fileManagement.upload(req, res, mockNext);
      fileId = res.jsonData.data.file_id;
    });

    it("should return file details for uploader", async () => {
      const req = mockReq(1, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.strictEqual(res.jsonData.data.file_id, fileId);
      assert.ok(!res.jsonData.data.storage_path); // Should not expose path
    });

    it("should return 404 for non-existent file", async () => {
      const req = mockReq(1, {}, { id: "FILE_NONEXISTENT" });
      const res = mockRes();

      await fileManagement.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });

    it("should deny access to other user's files", async () => {
      const req = mockReq(999, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.get(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe("Download file", () => {
    let fileId;
    let downloadToken;

    before(async () => {
      const mockFile = {
        name: "download-test.txt",
        size: 512,
        mimetype: "text/plain",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();
      await fileManagement.upload(req, res, mockNext);
      fileId = res.jsonData.data.file_id;
      downloadToken = res.jsonData.data.download_token;
    });

    it("should download file with valid token", async () => {
      const req = mockReq(1, {}, { id: fileId }, { token: downloadToken });
      const res = mockRes();

      await fileManagement.download(req, res, mockNext);

      // Note: In mock environment, download path would be set
      // In real environment, file would be sent via res.download()
      assert.ok(res.downloadPath || res.statusCode === 200);
    });

    it("should reject download without token for non-uploader", async () => {
      const req = mockReq(999, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.download(req, res, mockNext);

      assert.strictEqual(res.statusCode, 403);
    });

    it("should reject expired download token", async () => {
      // Create file with immediate expiration
      const mockFile = {
        name: "expired-test.txt",
        size: 512,
        mimetype: "text/plain",
        mv: async () => {},
      };

      const uploadReq = mockReq(1, {}, {}, {}, { file: mockFile });
      const uploadRes = mockRes();
      await fileManagement.upload(uploadReq, uploadRes, mockNext);

      // Manually expire token
      const fileId2 = uploadRes.jsonData.data.file_id;
      await db.query(
        `UPDATE files SET download_token_expires_at = NOW() - INTERVAL 1 HOUR WHERE file_id = ?`,
        [fileId2]
      );

      const downloadReq = mockReq(1, {}, { id: fileId2 }, { token: uploadRes.jsonData.data.download_token });
      const downloadRes = mockRes();

      await fileManagement.download(downloadReq, downloadRes, mockNext);

      assert.strictEqual(downloadRes.statusCode, 401);
      assert.ok(downloadRes.jsonData.error.includes("expired"));
    });

    it("should reject invalid download token", async () => {
      const req = mockReq(1, {}, { id: fileId }, { token: "invalid_token" });
      const res = mockRes();

      await fileManagement.download(req, res, mockNext);

      assert.strictEqual(res.statusCode, 401);
    });

    it("should increment download count", async () => {
      const beforeReq = mockReq(1, {}, { id: fileId });
      const beforeRes = mockRes();
      await fileManagement.get(beforeReq, beforeRes, mockNext);
      const countBefore = beforeRes.jsonData.data.download_count || 0;

      const downloadReq = mockReq(1, {}, { id: fileId }, { token: downloadToken });
      const downloadRes = mockRes();
      await fileManagement.download(downloadReq, downloadRes, mockNext);

      const afterReq = mockReq(1, {}, { id: fileId });
      const afterRes = mockRes();
      await fileManagement.get(afterReq, afterRes, mockNext);
      const countAfter = afterRes.jsonData.data.download_count || 0;

      assert.ok(countAfter > countBefore);
    });
  });

  describe("Generate download token", () => {
    let fileId;

    before(async () => {
      const mockFile = {
        name: "token-test.pdf",
        size: 1024,
        mimetype: "application/pdf",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();
      await fileManagement.upload(req, res, mockNext);
      fileId = res.jsonData.data.file_id;
    });

    it("should generate new download token", async () => {
      const req = mockReq(1, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.generateToken(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.download_token);
      assert.ok(res.jsonData.data.download_token_expires_at);
    });

    it("should return 404 for non-existent file", async () => {
      const req = mockReq(1, {}, { id: "FILE_NONEXISTENT" });
      const res = mockRes();

      await fileManagement.generateToken(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });

    it("should deny token generation for other user's files", async () => {
      const req = mockReq(999, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.generateToken(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe("Delete file", () => {
    let fileId;

    before(async () => {
      const mockFile = {
        name: "delete-test.txt",
        size: 256,
        mimetype: "text/plain",
        mv: async () => {},
      };

      const req = mockReq(1, {}, {}, {}, { file: mockFile });
      const res = mockRes();
      await fileManagement.upload(req, res, mockNext);
      fileId = res.jsonData.data.file_id;
    });

    it("should soft-delete file", async () => {
      const req = mockReq(1, {}, { id: fileId });
      const res = mockRes();

      await fileManagement.remove(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);

      // Verify it's soft-deleted
      const getReq = mockReq(1, {}, { id: fileId });
      const getRes = mockRes();
      await fileManagement.get(getReq, getRes, mockNext);
      assert.strictEqual(getRes.statusCode, 404);
    });

    it("should return 404 for non-existent file", async () => {
      const req = mockReq(1, {}, { id: "FILE_NONEXISTENT" });
      const res = mockRes();

      await fileManagement.remove(req, res, mockNext);

      assert.strictEqual(res.statusCode, 404);
    });

    it("should deny deletion of other user's files", async () => {
      // Create another file first
      const mockFile = {
        name: "protected-delete.txt",
        size: 256,
        mimetype: "text/plain",
        mv: async () => {},
      };

      const uploadReq = mockReq(1, {}, {}, {}, { file: mockFile });
      const uploadRes = mockRes();
      await fileManagement.upload(uploadReq, uploadRes, mockNext);
      const newFileId = uploadRes.jsonData.data.file_id;

      // Try to delete as different user
      const deleteReq = mockReq(999, {}, { id: newFileId });
      const deleteRes = mockRes();

      await fileManagement.remove(deleteReq, deleteRes, mockNext);

      assert.strictEqual(deleteRes.statusCode, 404);
    });
  });

  describe("File statistics", () => {
    it("should get file statistics for user", async () => {
      const req = mockReq(1);
      const res = mockRes();

      await fileManagement.getStats(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data);
      assert.ok("total_files" in res.jsonData.data);
      assert.ok("total_size_bytes" in res.jsonData.data);
    });

    it("should return zero for user with no files", async () => {
      const req = mockReq(888);
      const res = mockRes();

      await fileManagement.getStats(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.data.total_files, 0);
    });
  });

  describe("File analysis", () => {
    it("should provide file analysis", async () => {
      const req = mockReq(1, {}, {}, { limit: 10 });
      const res = mockRes();

      await fileManagement.getAnalysis(req, res, mockNext);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.jsonData.success, true);
      assert.ok(res.jsonData.data.mime_types);
      assert.ok(res.jsonData.data.projects);
    });
  });

  describe("Data isolation", () => {
    it("should only show files uploaded by user", async () => {
      // User 1 lists files
      const req1 = mockReq(1, {}, {}, { limit: 100, offset: 0 });
      const res1 = mockRes();
      await fileManagement.list(req1, res1, mockNext);
      const user1Count = res1.jsonData.pagination.total;

      // User 2 lists files
      const req2 = mockReq(999, {}, {}, { limit: 100, offset: 0 });
      const res2 = mockRes();
      await fileManagement.list(req2, res2, mockNext);
      const user2Count = res2.jsonData.pagination.total;

      assert.strictEqual(user2Count, 0);
      assert.ok(user1Count > 0);
    });
  });
});
