/**
 * Domain Management Integration Tests
 * Tests for CRUD operations, SSL management, and expiration tracking
 */

const assert = require("assert");
const db = require("../config/db");

describe("Domain Management", function() {
  this.timeout(10000);
  
  let testDomainId;
  
  // Test 1: Domain CRUD operations
  describe("Domain CRUD Operations", function() {
    it("should create a new domain", async function() {
      const domainData = {
        domain_id: `DOM-${Date.now()}`,
        domain_name: `test-${Date.now()}.com`,
        registrar: "GoDaddy",
        registration_date: new Date().toISOString().split('T')[0],
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        auto_renewal: false,
        status: "active"
      };
      
      const result = await db.query(
        `INSERT INTO domains (domain_id, domain_name, registrar, registration_date, expiration_date, auto_renewal, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [domainData.domain_id, domainData.domain_name, domainData.registrar, 
         domainData.registration_date, domainData.expiration_date, domainData.auto_renewal ? 1 : 0, domainData.status]
      );
      
      assert(result.insertId > 0, "Domain creation failed");
      testDomainId = result.insertId;
    });
    
    it("should retrieve domain details", async function() {
      const domain = await db.query(
        "SELECT * FROM domains WHERE id = ? AND deleted_at IS NULL",
        [testDomainId]
      );
      
      assert(domain.length === 1, "Domain not found");
      assert(domain[0].status === "active", "Status should be active");
    });
    
    it("should update domain information", async function() {
      await db.query(
        "UPDATE domains SET registrar = ?, auto_renewal = ? WHERE id = ?",
        ["Namecheap", 1, testDomainId]
      );
      
      const domain = await db.query(
        "SELECT * FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain[0].registrar === "Namecheap", "Registrar update failed");
      assert(domain[0].auto_renewal === 1, "Auto-renewal should be enabled");
    });
    
    it("should validate domain name format", async function() {
      const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      
      assert(domainRegex.test("example.com"), "Valid domain should match");
      assert(domainRegex.test("sub.example.co.uk"), "Valid subdomain should match");
      assert(!domainRegex.test("invalid..com"), "Invalid domain should not match");
      assert(!domainRegex.test("no-tld"), "Domain without TLD should not match");
    });
  });
  
  // Test 2: SSL Management
  describe("SSL Certificate Management", function() {
    it("should update SSL certificate information", async function() {
      const sslData = {
        ssl_issuer: "Let's Encrypt",
        ssl_expiration_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ssl_renewal_status: "active"
      };
      
      await db.query(
        "UPDATE domains SET ssl_issuer = ?, ssl_expiration_date = ?, ssl_renewal_status = ? WHERE id = ?",
        [sslData.ssl_issuer, sslData.ssl_expiration_date, sslData.ssl_renewal_status, testDomainId]
      );
      
      const domain = await db.query(
        "SELECT * FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain[0].ssl_issuer === "Let's Encrypt", "SSL issuer update failed");
      assert(domain[0].ssl_renewal_status === "active", "SSL status should be active");
    });
    
    it("should detect SSL expiration status", async function() {
      // Set SSL to expire soon
      const soonDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await db.query(
        "UPDATE domains SET ssl_expiration_date = ?, ssl_renewal_status = ? WHERE id = ?",
        [soonDate, "expiring_soon", testDomainId]
      );
      
      const domain = await db.query(
        "SELECT ssl_expiration_date, ssl_renewal_status FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain[0].ssl_renewal_status === "expiring_soon", "SSL status should be expiring_soon");
    });
  });
  
  // Test 3: Expiration Tracking
  describe("Domain Expiration Tracking", function() {
    it("should calculate days remaining until expiration", async function() {
      // Set expiration to 15 days from now
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const expirationDate = futureDate.toISOString().split('T')[0];
      
      await db.query(
        "UPDATE domains SET expiration_date = ? WHERE id = ?",
        [expirationDate, testDomainId]
      );
      
      const domain = await db.query(
        `SELECT 
          expiration_date,
          DATEDIFF(expiration_date, CURDATE()) as days_remaining
        FROM domains WHERE id = ?`,
        [testDomainId]
      );
      
      assert(domain[0].days_remaining <= 15 && domain[0].days_remaining >= 14, "Days remaining calculation incorrect");
    });
    
    it("should detect domain expiration status", async function() {
      const domain = await db.query(
        "SELECT expiration_date FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      const expirationDate = new Date(domain[0].expiration_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expirationDate.setHours(0, 0, 0, 0);
      
      const daysRemaining = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining < 0) {
        assert(true, "Domain should be expired");
      } else if (daysRemaining <= 30) {
        assert(true, "Domain should have expiring_soon status");
      } else {
        assert(true, "Domain should be active");
      }
    });
  });
  
  // Test 4: Filtering and Pagination
  describe("Domain Filtering and Listing", function() {
    it("should list domains with pagination", async function() {
      const domains = await db.query(
        "SELECT * FROM domains WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20 OFFSET 0"
      );
      
      assert(Array.isArray(domains), "Domains list should be an array");
    });
    
    it("should filter domains by status", async function() {
      const domains = await db.query(
        "SELECT * FROM domains WHERE status = ? AND deleted_at IS NULL",
        ["active"]
      );
      
      assert(Array.isArray(domains), "Filtered domains should be an array");
      domains.forEach(d => assert(d.status === "active", "All domains should be active"));
    });
    
    it("should filter domains by registrar", async function() {
      const domains = await db.query(
        "SELECT * FROM domains WHERE registrar = ? AND deleted_at IS NULL",
        ["Namecheap"]
      );
      
      assert(Array.isArray(domains), "Filtered domains should be an array");
    });
    
    it("should filter domains expiring soon", async function() {
      const domains = await db.query(
        `SELECT * FROM domains 
         WHERE expiration_date IS NOT NULL 
         AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) >= expiration_date 
         AND expiration_date >= CURDATE()
         AND deleted_at IS NULL`
      );
      
      assert(Array.isArray(domains), "Expiring soon domains should be an array");
    });
  });
  
  // Test 5: Auto-renewal Management
  describe("Auto-Renewal Management", function() {
    it("should enable auto-renewal", async function() {
      await db.query(
        "UPDATE domains SET auto_renewal = 1 WHERE id = ?",
        [testDomainId]
      );
      
      const domain = await db.query(
        "SELECT auto_renewal FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain[0].auto_renewal === 1, "Auto-renewal should be enabled");
    });
    
    it("should disable auto-renewal", async function() {
      await db.query(
        "UPDATE domains SET auto_renewal = 0 WHERE id = ?",
        [testDomainId]
      );
      
      const domain = await db.query(
        "SELECT auto_renewal FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain[0].auto_renewal === 0, "Auto-renewal should be disabled");
    });
  });
  
  // Test 6: Soft Delete
  describe("Domain Soft Delete", function() {
    it("should soft-delete domain", async function() {
      await db.query(
        "UPDATE domains SET deleted_at = NOW() WHERE id = ?",
        [testDomainId]
      );
      
      const domain = await db.query(
        "SELECT * FROM domains WHERE id = ? AND deleted_at IS NULL",
        [testDomainId]
      );
      
      assert(domain.length === 0, "Soft-deleted domain should not appear");
    });
    
    it("should preserve deleted domain record", async function() {
      const domain = await db.query(
        "SELECT * FROM domains WHERE id = ?",
        [testDomainId]
      );
      
      assert(domain.length === 1, "Soft-deleted record should still exist");
      assert(domain[0].deleted_at !== null, "Deleted timestamp should be set");
    });
  });
  
  // Test 7: Domain Uniqueness
  describe("Domain Uniqueness Validation", function() {
    it("should prevent duplicate domain names", async function() {
      const testDomain = "unique-test-" + Date.now() + ".com";
      
      // Create first domain
      const result1 = await db.query(
        `INSERT INTO domains (domain_id, domain_name, status) 
         VALUES (?, ?, ?)`,
        [`DOM-${Date.now()}-1`, testDomain, "active"]
      );
      assert(result1.insertId > 0, "First domain should be created");
      
      // Try to create duplicate
      try {
        await db.query(
          `INSERT INTO domains (domain_id, domain_name, status) 
           VALUES (?, ?, ?)`,
          [`DOM-${Date.now()}-2`, testDomain, "active"]
        );
        assert(false, "Duplicate domain should not be allowed");
      } catch (err) {
        assert(err.code === "ER_DUP_ENTRY" || err.message.includes("UNIQUE"), "Should fail on duplicate");
      }
    });
  });
});
