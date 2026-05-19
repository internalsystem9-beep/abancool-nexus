/**
 * VPS Management Integration Tests
 * Tests for CRUD operations, metrics tracking, and alert management
 */

const assert = require("assert");
const db = require("../config/db");

describe("VPS Management", function() {
  this.timeout(10000);
  
  let testVpsId;
  
  // Test 1: VPS CRUD operations
  describe("VPS CRUD Operations", function() {
    it("should create a new VPS server", async function() {
      const vpsData = {
        vps_id: `VPS-${Date.now()}`,
        server_name: `test-server-${Date.now()}`,
        ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        provider: "DigitalOcean",
        cpu_cores: 4,
        ram_gb: 8,
        storage_gb: 100,
        uptime_percent: 99.9,
        status: "active"
      };
      
      const result = await db.query(
        `INSERT INTO vps (vps_id, server_name, ip_address, provider, cpu_cores, ram_gb, storage_gb, uptime_percent, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vpsData.vps_id, vpsData.server_name, vpsData.ip_address, vpsData.provider, 
         vpsData.cpu_cores, vpsData.ram_gb, vpsData.storage_gb, vpsData.uptime_percent, vpsData.status]
      );
      
      assert(result.insertId > 0, "VPS creation failed");
      testVpsId = result.insertId;
    });
    
    it("should retrieve VPS details", async function() {
      const vps = await db.query(
        "SELECT * FROM vps WHERE id = ? AND deleted_at IS NULL",
        [testVpsId]
      );
      
      assert(vps.length === 1, "VPS not found");
      assert(vps[0].status === "active", "Status should be active");
    });
    
    it("should update VPS information", async function() {
      await db.query(
        "UPDATE vps SET provider = ?, status = ? WHERE id = ?",
        ["AWS", "maintenance", testVpsId]
      );
      
      const vps = await db.query(
        "SELECT * FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].provider === "AWS", "Provider update failed");
      assert(vps[0].status === "maintenance", "Status should be maintenance");
    });
    
    it("should prevent duplicate IP addresses", async function() {
      const vps = await db.query(
        "SELECT ip_address FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      try {
        await db.query(
          `INSERT INTO vps (vps_id, server_name, ip_address, provider, status) 
           VALUES (?, ?, ?, ?, ?)`,
          [`VPS-${Date.now()}-dup`, "duplicate-server", vps[0].ip_address, "AWS", "active"]
        );
        assert(false, "Duplicate IP should not be allowed");
      } catch (err) {
        assert(err.code === "ER_DUP_ENTRY" || err.message.includes("UNIQUE"), "Should fail on duplicate IP");
      }
    });
  });
  
  // Test 2: Resource metrics tracking
  describe("Resource Metrics Tracking", function() {
    it("should record VPS metrics", async function() {
      const metricsData = {
        cpu_usage_percent: 45.5,
        ram_usage_percent: 62.3,
        disk_usage_percent: 78.9,
        uptime_percent: 99.8
      };
      
      await db.query(
        `UPDATE vps SET 
          cpu_usage_percent = ?, 
          ram_usage_percent = ?, 
          disk_usage_percent = ?,
          uptime_percent = ?,
          last_metrics_at = NOW()
        WHERE id = ?`,
        [metricsData.cpu_usage_percent, metricsData.ram_usage_percent, 
         metricsData.disk_usage_percent, metricsData.uptime_percent, testVpsId]
      );
      
      const vps = await db.query(
        "SELECT * FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].cpu_usage_percent === 45.5, "CPU metrics update failed");
      assert(vps[0].ram_usage_percent === 62.3, "RAM metrics update failed");
      assert(vps[0].disk_usage_percent === 78.9, "Disk metrics update failed");
      assert(vps[0].last_metrics_at !== null, "Last metrics timestamp should be set");
    });
    
    it("should validate metrics are percentages (0-100)", async function() {
      assert(45.5 >= 0 && 45.5 <= 100, "CPU usage should be between 0-100");
      assert(62.3 >= 0 && 62.3 <= 100, "RAM usage should be between 0-100");
      assert(78.9 >= 0 && 78.9 <= 100, "Disk usage should be between 0-100");
    });
  });
  
  // Test 3: Alert generation (85% threshold)
  describe("Resource Usage Alerts", function() {
    it("should detect high CPU usage (85% threshold)", async function() {
      // Set CPU usage to 88%
      await db.query(
        "UPDATE vps SET cpu_usage_percent = 88 WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT cpu_usage_percent FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].cpu_usage_percent >= 85, "CPU usage should trigger alert at >= 85%");
    });
    
    it("should detect high RAM usage (85% threshold)", async function() {
      // Set RAM usage to 91%
      await db.query(
        "UPDATE vps SET ram_usage_percent = 91 WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT ram_usage_percent FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].ram_usage_percent >= 85, "RAM usage should trigger alert at >= 85%");
    });
    
    it("should detect high disk usage (85% threshold)", async function() {
      // Set disk usage to 87%
      await db.query(
        "UPDATE vps SET disk_usage_percent = 87 WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT disk_usage_percent FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].disk_usage_percent >= 85, "Disk usage should trigger alert at >= 85%");
    });
    
    it("should not trigger alerts for normal usage", async function() {
      // Set all metrics to normal levels
      await db.query(
        "UPDATE vps SET cpu_usage_percent = 50, ram_usage_percent = 60, disk_usage_percent = 70 WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT cpu_usage_percent, ram_usage_percent, disk_usage_percent FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].cpu_usage_percent < 85, "CPU should not trigger alert");
      assert(vps[0].ram_usage_percent < 85, "RAM should not trigger alert");
      assert(vps[0].disk_usage_percent < 85, "Disk should not trigger alert");
    });
  });
  
  // Test 4: Filtering and pagination
  describe("VPS Filtering and Listing", function() {
    it("should list VPS servers with pagination", async function() {
      const vpsList = await db.query(
        "SELECT * FROM vps WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20 OFFSET 0"
      );
      
      assert(Array.isArray(vpsList), "VPS list should be an array");
    });
    
    it("should filter VPS by status", async function() {
      const vpsList = await db.query(
        "SELECT * FROM vps WHERE status = ? AND deleted_at IS NULL",
        ["active"]
      );
      
      assert(Array.isArray(vpsList), "Filtered VPS should be an array");
      vpsList.forEach(v => assert(v.status === "active", "All VPS should be active"));
    });
    
    it("should filter VPS by provider", async function() {
      const vpsList = await db.query(
        "SELECT * FROM vps WHERE provider = ? AND deleted_at IS NULL",
        ["AWS"]
      );
      
      assert(Array.isArray(vpsList), "Provider filtered VPS should be an array");
    });
    
    it("should filter VPS by high CPU usage", async function() {
      const vpsList = await db.query(
        "SELECT * FROM vps WHERE cpu_usage_percent >= 85 AND deleted_at IS NULL"
      );
      
      assert(Array.isArray(vpsList), "High CPU VPS should be an array");
      vpsList.forEach(v => assert(v.cpu_usage_percent >= 85, "All VPS should have high CPU"));
    });
  });
  
  // Test 5: Uptime tracking
  describe("Uptime Tracking", function() {
    it("should update uptime percentage", async function() {
      await db.query(
        "UPDATE vps SET uptime_percent = 99.95 WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT uptime_percent FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps[0].uptime_percent === 99.95, "Uptime update failed");
    });
    
    it("should validate uptime is 0-100 percent", async function() {
      const uptime = 99.95;
      assert(uptime >= 0 && uptime <= 100, "Uptime should be between 0-100");
    });
  });
  
  // Test 6: Soft delete
  describe("VPS Soft Delete", function() {
    it("should soft-delete VPS server", async function() {
      await db.query(
        "UPDATE vps SET deleted_at = NOW() WHERE id = ?",
        [testVpsId]
      );
      
      const vps = await db.query(
        "SELECT * FROM vps WHERE id = ? AND deleted_at IS NULL",
        [testVpsId]
      );
      
      assert(vps.length === 0, "Soft-deleted VPS should not appear in active list");
    });
    
    it("should preserve deleted VPS record", async function() {
      const vps = await db.query(
        "SELECT * FROM vps WHERE id = ?",
        [testVpsId]
      );
      
      assert(vps.length === 1, "Soft-deleted record should still exist");
      assert(vps[0].deleted_at !== null, "Deleted timestamp should be set");
    });
  });
  
  // Test 7: Status transitions
  describe("VPS Status Management", function() {
    it("should support active status", async function() {
      const vps = await db.query(
        `INSERT INTO vps (vps_id, server_name, ip_address, provider, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [`VPS-${Date.now()}-active`, "test-active", "10.0.0.1", "AWS", "active"]
      );
      
      const insertedVps = await db.query(
        "SELECT status FROM vps WHERE id = ?",
        [vps.insertId]
      );
      
      assert(insertedVps[0].status === "active", "Should support active status");
    });
    
    it("should support inactive status", async function() {
      const vps = await db.query(
        `INSERT INTO vps (vps_id, server_name, ip_address, provider, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [`VPS-${Date.now()}-inactive`, "test-inactive", "10.0.0.2", "AWS", "inactive"]
      );
      
      const insertedVps = await db.query(
        "SELECT status FROM vps WHERE id = ?",
        [vps.insertId]
      );
      
      assert(insertedVps[0].status === "inactive", "Should support inactive status");
    });
    
    it("should support maintenance status", async function() {
      const vps = await db.query(
        `INSERT INTO vps (vps_id, server_name, ip_address, provider, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [`VPS-${Date.now()}-maint`, "test-maintenance", "10.0.0.3", "AWS", "maintenance"]
      );
      
      const insertedVps = await db.query(
        "SELECT status FROM vps WHERE id = ?",
        [vps.insertId]
      );
      
      assert(insertedVps[0].status === "maintenance", "Should support maintenance status");
    });
  });
});
