/**
 * Hosting Management Integration Tests
 * Tests for CRUD operations, resource tracking, and alert management
 */

const assert = require("assert");
const db = require("../config/db");

describe("Hosting Management", function() {
  this.timeout(10000);
  
  let testHostingId;
  let testClientId = 1; // Assumes a test client exists
  
  // Test 1: Create hosting package
  describe("Hosting Packages", function() {
    it("should create a new hosting package", async function() {
      const packageData = {
        package_id: `PKG-${Date.now()}`,
        package_name: `Test Package ${Date.now()}`,
        price: 99.99,
        disk_space_gb: 100,
        bandwidth_gb: 500,
        features: "SSL, Email, Backup"
      };
      
      const result = await db.query(
        `INSERT INTO hosting_packages (package_id, package_name, price, disk_space_gb, bandwidth_gb, features) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [packageData.package_id, packageData.package_name, packageData.price, 
         packageData.disk_space_gb, packageData.bandwidth_gb, packageData.features]
      );
      
      assert(result.insertId > 0, "Package creation failed");
    });
    
    it("should list all hosting packages", async function() {
      const packages = await db.query(
        "SELECT * FROM hosting_packages WHERE deleted_at IS NULL"
      );
      
      assert(Array.isArray(packages), "Packages should be an array");
    });
  });
  
  // Test 2: Hosting CRUD operations
  describe("Hosting CRUD Operations", function() {
    it("should create a new hosting account", async function() {
      const hostingData = {
        hosting_id: `HT-${Date.now()}`,
        client_id: testClientId,
        domain_name: `test-${Date.now()}.com`,
        cpanel_account: "testcpanel",
        package_type: "Basic",
        disk_quota_gb: 100,
        bandwidth_limit_gb: 500,
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: "active"
      };
      
      const result = await db.query(
        `INSERT INTO hosting (hosting_id, client_id, domain_name, cpanel_account, package_type, 
         disk_quota_gb, bandwidth_limit_gb, renewal_date, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hostingData.hosting_id, hostingData.client_id, hostingData.domain_name, 
         hostingData.cpanel_account, hostingData.package_type, hostingData.disk_quota_gb,
         hostingData.bandwidth_limit_gb, hostingData.renewal_date, hostingData.status]
      );
      
      assert(result.insertId > 0, "Hosting creation failed");
      testHostingId = result.insertId;
    });
    
    it("should retrieve hosting details", async function() {
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE id = ? AND deleted_at IS NULL",
        [testHostingId]
      );
      
      assert(hosting.length === 1, "Hosting not found");
      assert(hosting[0].status === "active", "Status should be active");
    });
    
    it("should update hosting account", async function() {
      await db.query(
        "UPDATE hosting SET status = ? WHERE id = ?",
        ["suspended", testHostingId]
      );
      
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE id = ?",
        [testHostingId]
      );
      
      assert(hosting[0].status === "suspended", "Status update failed");
    });
    
    it("should calculate resource usage percentage", async function() {
      // Update disk and bandwidth usage
      await db.query(
        "UPDATE hosting SET disk_used_gb = 80, bandwidth_used_gb = 400 WHERE id = ?",
        [testHostingId]
      );
      
      const hosting = await db.query(
        `SELECT 
          id,
          disk_quota_gb,
          disk_used_gb,
          ROUND((disk_used_gb / disk_quota_gb) * 100, 2) as disk_usage_percent,
          bandwidth_limit_gb,
          bandwidth_used_gb,
          ROUND((bandwidth_used_gb / bandwidth_limit_gb) * 100, 2) as bandwidth_usage_percent
        FROM hosting WHERE id = ?`,
        [testHostingId]
      );
      
      assert(hosting[0].disk_usage_percent === 80, "Disk usage calculation incorrect");
      assert(hosting[0].bandwidth_usage_percent === 80, "Bandwidth usage calculation incorrect");
    });
    
    it("should detect high resource usage alerts", async function() {
      const hosting = await db.query(
        `SELECT 
          disk_used_gb, disk_quota_gb, bandwidth_used_gb, bandwidth_limit_gb
        FROM hosting WHERE id = ?`,
        [testHostingId]
      );
      
      const h = hosting[0];
      
      // Check disk alert
      if (h.disk_quota_gb && h.disk_used_gb) {
        const diskPercent = (h.disk_used_gb / h.disk_quota_gb) * 100;
        assert(diskPercent >= 80, "Disk usage should be at 80% threshold");
      }
      
      // Check bandwidth alert
      if (h.bandwidth_limit_gb && h.bandwidth_used_gb) {
        const bandwidthPercent = (h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100;
        assert(bandwidthPercent >= 80, "Bandwidth usage should be at 80% threshold");
      }
    });
  });
  
  // Test 3: Filtering and pagination
  describe("Hosting Filtering and Listing", function() {
    it("should list hosting accounts with pagination", async function() {
      const hosting = await db.query(
        `SELECT * FROM hosting WHERE deleted_at IS NULL 
         ORDER BY created_at DESC LIMIT 20 OFFSET 0`
      );
      
      assert(Array.isArray(hosting), "Hosting list should be an array");
    });
    
    it("should filter hosting by status", async function() {
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE status = ? AND deleted_at IS NULL",
        ["active"]
      );
      
      assert(Array.isArray(hosting), "Filtered hosting should be an array");
    });
    
    it("should filter hosting by client", async function() {
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE client_id = ? AND deleted_at IS NULL",
        [testClientId]
      );
      
      assert(Array.isArray(hosting), "Client hosting should be an array");
    });
  });
  
  // Test 4: Soft delete
  describe("Hosting Soft Delete", function() {
    it("should soft-delete hosting account", async function() {
      await db.query(
        "UPDATE hosting SET deleted_at = NOW() WHERE id = ?",
        [testHostingId]
      );
      
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE id = ? AND deleted_at IS NULL",
        [testHostingId]
      );
      
      assert(hosting.length === 0, "Soft-deleted hosting should not appear");
    });
    
    it("should preserve billing history on soft delete", async function() {
      const hosting = await db.query(
        "SELECT * FROM hosting WHERE id = ?",
        [testHostingId]
      );
      
      assert(hosting.length === 1, "Soft-deleted record should still exist");
      assert(hosting[0].deleted_at !== null, "Deleted timestamp should be set");
    });
  });
});
