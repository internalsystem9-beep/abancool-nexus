#!/usr/bin/env node

const db = require("../config/db");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");

/**
 * Generate unique IDs
 */
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Seed database with initial data
 */
async function seed() {
  try {
    console.log("[seed] Starting database seeding...\n");

    // 1. Create Super Admin User
    console.log("[seed] Creating super admin user...");
    const adminPassword = await bcryptjs.hash("Admin@123456", 12);
    const adminResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, status, totp_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["admin@abancool.com", adminPassword, "Admin", "User", "+254712345678", "active", false]
    );
    const adminId = adminResult.insertId;
    console.log(`✓ Super Admin created (ID: ${adminId})`);

    // 2. Assign Super Admin Role
    console.log("[seed] Assigning super admin role...");
    await db.query(
      `INSERT INTO user_roles (user_id, role, assigned_by)
       VALUES (?, ?, ?)`,
      [adminId, "super_admin", adminId]
    );
    console.log("✓ Super admin role assigned");

    // 3. Create additional staff users
    console.log("[seed] Creating staff users...");
    const staffUsers = [
      {
        email: "developer@abancool.com",
        name: "Dev",
        role: "developer",
      },
      {
        email: "support@abancool.com",
        name: "Support",
        role: "support",
      },
      {
        email: "finance@abancool.com",
        name: "Finance",
        role: "finance",
      },
      {
        email: "sales@abancool.com",
        name: "Sales",
        role: "sales",
      },
    ];

    const staffIds = [];
    for (const staff of staffUsers) {
      const hashedPassword = await bcryptjs.hash("Staff@123456", 12);
      const result = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status, totp_enabled)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [staff.email, hashedPassword, staff.name, "Staff", "active", false]
      );
      staffIds.push(result.insertId);

      await db.query(
        `INSERT INTO user_roles (user_id, role, assigned_by)
         VALUES (?, ?, ?)`,
        [result.insertId, staff.role, adminId]
      );
      console.log(`✓ ${staff.name} user created (${staff.role})`);
    }

    // 4. Create sample clients
    console.log("\n[seed] Creating sample clients...");
    const clients = [
      {
        company_name: "Tech Solutions Ltd",
        email: "contact@techsolutions.com",
        phone: "+254712345678",
        city: "Nairobi",
        country: "Kenya",
        kra_pin: "A001234567B",
      },
      {
        company_name: "Digital Marketing Agency",
        email: "info@digitalagency.com",
        phone: "+254723456789",
        city: "Nairobi",
        country: "Kenya",
        kra_pin: "A002345678B",
      },
      {
        company_name: "E-Commerce Store",
        email: "support@ecommerce.com",
        phone: "+254734567890",
        city: "Mombasa",
        country: "Kenya",
        kra_pin: "A003456789B",
      },
    ];

    const clientIds = [];
    for (const client of clients) {
      const clientId = generateId("CLI");
      const result = await db.query(
        `INSERT INTO clients (client_id, company_name, email, phone, city, country, kra_pin, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          client.company_name,
          client.email,
          client.phone,
          client.city,
          client.country,
          client.kra_pin,
          "active",
          adminId,
        ]
      );
      clientIds.push(result.insertId);
      console.log(`✓ Client created: ${client.company_name}`);
    }

    // 5. Create sample contacts
    console.log("\n[seed] Creating sample contacts...");
    for (let i = 0; i < clientIds.length; i++) {
      const contacts = [
        {
          contact_name: "John Doe",
          email: `john@client${i + 1}.com`,
          phone: "+254712345678",
          role: "Manager",
          is_primary: true,
        },
        {
          contact_name: "Jane Smith",
          email: `jane@client${i + 1}.com`,
          phone: "+254723456789",
          role: "Technical Lead",
          is_primary: false,
        },
      ];

      for (const contact of contacts) {
        await db.query(
          `INSERT INTO contacts (client_id, contact_name, email, phone, role, is_primary)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [clientIds[i], contact.contact_name, contact.email, contact.phone, contact.role, contact.is_primary]
        );
      }
      console.log(`✓ Contacts created for client ${i + 1}`);
    }

    // 6. Create sample projects
    console.log("\n[seed] Creating sample projects...");
    const projects = [
      {
        project_name: "Website Redesign",
        description: "Complete redesign of company website",
        status: "in_progress",
        budget: 50000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        project_name: "Mobile App Development",
        description: "Native iOS and Android app",
        status: "planning",
        budget: 150000,
        deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      {
        project_name: "API Integration",
        description: "Third-party API integration",
        status: "testing",
        budget: 25000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];

    const projectIds = [];
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const projectId = generateId("PRJ");
      const result = await db.query(
        `INSERT INTO projects (project_id, client_id, project_name, description, status, budget, deadline, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          clientIds[i % clientIds.length],
          project.project_name,
          project.description,
          project.status,
          project.budget,
          project.deadline,
          staffIds[0],
        ]
      );
      projectIds.push(result.insertId);
      console.log(`✓ Project created: ${project.project_name}`);
    }

    // 7. Create sample hosting accounts
    console.log("\n[seed] Creating sample hosting accounts...");
    for (let i = 0; i < clientIds.length; i++) {
      const hostingId = generateId("HOST");
      await db.query(
        `INSERT INTO hosting (hosting_id, client_id, domain_name, cpanel_account, package_type, disk_quota_gb, bandwidth_limit_gb, status, renewal_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hostingId,
          clientIds[i],
          `client${i + 1}.com`,
          `cpanel${i + 1}`,
          "Professional",
          100,
          500,
          "active",
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        ]
      );
      console.log(`✓ Hosting account created for client ${i + 1}`);
    }

    // 8. Create sample domains
    console.log("\n[seed] Creating sample domains...");
    const domains = [
      {
        domain_name: "techsolutions.com",
        registrar: "Namecheap",
        ssl_issuer: "Let's Encrypt",
      },
      {
        domain_name: "digitalagency.co.ke",
        registrar: "GoDaddy",
        ssl_issuer: "Comodo",
      },
      {
        domain_name: "ecommerce.shop",
        registrar: "Namecheap",
        ssl_issuer: "Let's Encrypt",
      },
    ];

    for (const domain of domains) {
      const domainId = generateId("DOM");
      await db.query(
        `INSERT INTO domains (domain_id, domain_name, registrar, registration_date, expiration_date, auto_renewal, ssl_issuer, ssl_expiration_date, ssl_renewal_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          domainId,
          domain.domain_name,
          domain.registrar,
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          true,
          domain.ssl_issuer,
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          "active",
          "active",
        ]
      );
      console.log(`✓ Domain created: ${domain.domain_name}`);
    }

    // 9. Create sample VPS servers
    console.log("\n[seed] Creating sample VPS servers...");
    const vpsServers = [
      {
        server_name: "Production Server 1",
        ip_address: "192.168.1.100",
        provider: "DigitalOcean",
        cpu_cores: 4,
        ram_gb: 8,
        storage_gb: 160,
      },
      {
        server_name: "Staging Server",
        ip_address: "192.168.1.101",
        provider: "Linode",
        cpu_cores: 2,
        ram_gb: 4,
        storage_gb: 80,
      },
    ];

    for (const vps of vpsServers) {
      const vpsId = generateId("VPS");
      await db.query(
        `INSERT INTO vps (vps_id, client_id, server_name, ip_address, provider, cpu_cores, ram_gb, storage_gb, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vpsId,
          clientIds[0],
          vps.server_name,
          vps.ip_address,
          vps.provider,
          vps.cpu_cores,
          vps.ram_gb,
          vps.storage_gb,
          "active",
        ]
      );
      console.log(`✓ VPS server created: ${vps.server_name}`);
    }

    // 10. Create sample invoices
    console.log("\n[seed] Creating sample invoices...");
    for (let i = 0; i < clientIds.length; i++) {
      const invoiceId = generateId("INV");
      const invoiceNumber = `INV-2024-${String(i + 1).padStart(3, "0")}`;
      const subtotal = 10000;
      const taxRate = 16;
      const taxAmount = (subtotal * taxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      const result = await db.query(
        `INSERT INTO invoices (invoice_id, invoice_number, client_id, subtotal, tax_amount, total_amount, tax_rate, status, payment_status, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          invoiceNumber,
          clientIds[i],
          subtotal,
          taxAmount,
          totalAmount,
          taxRate,
          "sent",
          "unpaid",
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          adminId,
        ]
      );

      // Add invoice items
      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, "Web Hosting Services", 1, 5000, 5000]
      );

      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, "Domain Registration", 1, 5000, 5000]
      );

      console.log(`✓ Invoice created: ${invoiceNumber}`);
    }

    // 11. Create sample support tickets
    console.log("\n[seed] Creating sample support tickets...");
    const ticketTitles = [
      "Website is down",
      "Email not working",
      "Database performance issue",
      "SSL certificate renewal",
      "Backup restoration needed",
    ];

    for (let i = 0; i < clientIds.length; i++) {
      for (let j = 0; j < 2; j++) {
        const ticketId = generateId("TKT");
        const result = await db.query(
          `INSERT INTO support_tickets (ticket_id, client_id, title, description, priority, status, assigned_to, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ticketId,
            clientIds[i],
            ticketTitles[j % ticketTitles.length],
            `Issue description for ticket ${ticketId}`,
            ["low", "medium", "high"][j % 3],
            "open",
            staffIds[1],
            adminId,
          ]
        );

        // Add ticket comment
        await db.query(
          `INSERT INTO ticket_comments (ticket_id, author_id, comment_text, is_internal)
           VALUES (?, ?, ?, ?)`,
          [result.insertId, adminId, "Initial assessment: Issue requires investigation", false]
        );
      }
      console.log(`✓ Support tickets created for client ${i + 1}`);
    }

    console.log("\n[seed] ✓ Database seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("[seed] ✗ Seeding failed:", err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
