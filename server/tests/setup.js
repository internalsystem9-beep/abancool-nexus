/**
 * Test Setup Utilities
 * Provides common setup, fixtures, and teardown for all tests
 */

const db = require('../src/config/db');

/**
 * Test User Fixtures
 */
const testUsers = {
  superAdmin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    first_name: 'Test',
    last_name: 'Admin',
    phone: '+254712345678',
    role: 'super_admin',
    status: 'active'
  },
  supportAgent: {
    email: 'support@test.com',
    password: 'TestPassword123!',
    first_name: 'Support',
    last_name: 'Agent',
    phone: '+254712345679',
    role: 'support_agent',
    status: 'active'
  },
  regularUser: {
    email: 'user@test.com',
    password: 'TestPassword123!',
    first_name: 'Regular',
    last_name: 'User',
    phone: '+254712345680',
    role: 'user',
    status: 'active'
  },
  inactiveUser: {
    email: 'inactive@test.com',
    password: 'TestPassword123!',
    first_name: 'Inactive',
    last_name: 'User',
    phone: '+254712345681',
    role: 'user',
    status: 'inactive'
  }
};

/**
 * Test Client Fixtures
 */
const testClients = {
  client1: {
    company_name: 'Tech Solutions Inc',
    industry: 'Technology',
    country: 'Kenya',
    status: 'active'
  },
  client2: {
    company_name: 'Digital Marketing Ltd',
    industry: 'Marketing',
    country: 'Uganda',
    status: 'active'
  },
  inactiveClient: {
    company_name: 'Inactive Company',
    industry: 'Services',
    country: 'Tanzania',
    status: 'inactive'
  }
};

/**
 * Test Project Fixtures
 */
const testProjects = {
  project1: {
    project_name: 'E-commerce Platform',
    description: 'Custom e-commerce solution',
    status: 'active'
  },
  project2: {
    project_name: 'CRM System',
    description: 'Customer relationship management',
    status: 'active'
  },
  completedProject: {
    project_name: 'Completed Project',
    description: 'Successfully completed',
    status: 'completed'
  }
};

/**
 * Test Domain Fixtures
 */
const testDomains = {
  domain1: {
    domain_name: 'example.com',
    registrar: 'GoDaddy',
    status: 'active',
    auto_renew: true,
    expiry_date: '2025-12-31'
  },
  domain2: {
    domain_name: 'test.io',
    registrar: 'Namecheap',
    status: 'active',
    auto_renew: false,
    expiry_date: '2024-06-30'
  }
};

/**
 * Test Hosting Fixtures
 */
const testHosting = {
  hosting1: {
    hosting_type: 'shared',
    space: '100GB',
    bandwidth: 'Unlimited',
    status: 'active'
  },
  hosting2: {
    hosting_type: 'vps',
    space: '500GB',
    bandwidth: '5TB',
    status: 'active'
  }
};

/**
 * Test Invoice Fixtures
 */
const testInvoices = {
  invoice1: {
    invoice_number: 'INV-2024-001',
    total_amount: 5000.00,
    status: 'sent',
    due_date: '2024-06-15'
  },
  invoice2: {
    invoice_number: 'INV-2024-002',
    total_amount: 3500.00,
    status: 'paid',
    due_date: '2024-05-15'
  }
};

/**
 * Test Support Ticket Fixtures
 */
const testTickets = {
  ticket1: {
    subject: 'SSL Certificate Issue',
    description: 'SSL certificate needs renewal',
    priority: 'high',
    status: 'open'
  },
  ticket2: {
    subject: 'Database Performance',
    description: 'Database queries are slow',
    priority: 'medium',
    status: 'in_progress'
  }
};

/**
 * Test Backup Fixtures
 */
const testBackups = {
  backup1: {
    backup_name: 'Daily Backup',
    backup_type: 'full',
    status: 'completed',
    size_bytes: 1073741824
  },
  backup2: {
    backup_name: 'Database Backup',
    backup_type: 'database',
    status: 'completed',
    size_bytes: 536870912
  }
};

/**
 * Clear test data from database
 */
const clearTestData = async () => {
  try {
    // List of tables to truncate (in dependency order)
    const tables = [
      'invoice_items',
      'quote_items',
      'invoices',
      'quotes',
      'transactions',
      'support_ticket_replies',
      'support_tickets',
      'backup_verifications',
      'restore_operations',
      'backup_schedules',
      'backup_history',
      'automation_logs',
      'automations',
      'files',
      'password_vault',
      'domains',
      'hosting',
      'project_team',
      'projects',
      'contacts',
      'clients',
      'sessions',
      'user_permissions',
      'user_roles',
      'users'
    ];

    for (const table of tables) {
      try {
        await db.query(`TRUNCATE TABLE ${table}`);
      } catch (error) {
        // Table might not exist, continue
      }
    }
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
};

/**
 * Create test user in database
 * @param {object} userData - User data
 * @returns {object} Created user with ID
 */
const createTestUser = async (userData = testUsers.regularUser) => {
  try {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      userData.email,
      'hashed_password', // In real tests, use proper hashing
      userData.first_name,
      userData.last_name,
      userData.phone,
      userData.role,
      userData.status
    ]);

    return { id: result.insertId, ...userData };
  } catch (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }
};

/**
 * Create test client in database
 * @param {integer} userId - User ID (account owner)
 * @param {object} clientData - Client data
 * @returns {object} Created client with ID
 */
const createTestClient = async (userId, clientData = testClients.client1) => {
  try {
    const query = `
      INSERT INTO clients (user_id, company_name, industry, country, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      userId,
      clientData.company_name,
      clientData.industry,
      clientData.country,
      clientData.status
    ]);

    return { id: result.insertId, user_id: userId, ...clientData };
  } catch (error) {
    throw new Error(`Failed to create test client: ${error.message}`);
  }
};

/**
 * Create test project in database
 * @param {integer} clientId - Client ID
 * @param {object} projectData - Project data
 * @returns {object} Created project with ID
 */
const createTestProject = async (clientId, projectData = testProjects.project1) => {
  try {
    const query = `
      INSERT INTO projects (client_id, project_name, description, status)
      VALUES (?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      clientId,
      projectData.project_name,
      projectData.description,
      projectData.status
    ]);

    return { id: result.insertId, client_id: clientId, ...projectData };
  } catch (error) {
    throw new Error(`Failed to create test project: ${error.message}`);
  }
};

/**
 * Create test domain in database
 * @param {integer} projectId - Project ID
 * @param {object} domainData - Domain data
 * @returns {object} Created domain with ID
 */
const createTestDomain = async (projectId, domainData = testDomains.domain1) => {
  try {
    const query = `
      INSERT INTO domains (project_id, domain_name, registrar, status, auto_renew, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      projectId,
      domainData.domain_name,
      domainData.registrar,
      domainData.status,
      domainData.auto_renew ? 1 : 0,
      domainData.expiry_date
    ]);

    return { id: result.insertId, project_id: projectId, ...domainData };
  } catch (error) {
    throw new Error(`Failed to create test domain: ${error.message}`);
  }
};

/**
 * Create test hosting in database
 * @param {integer} projectId - Project ID
 * @param {object} hostingData - Hosting data
 * @returns {object} Created hosting with ID
 */
const createTestHosting = async (projectId, hostingData = testHosting.hosting1) => {
  try {
    const query = `
      INSERT INTO hosting (project_id, hosting_type, space, bandwidth, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      projectId,
      hostingData.hosting_type,
      hostingData.space,
      hostingData.bandwidth,
      hostingData.status
    ]);

    return { id: result.insertId, project_id: projectId, ...hostingData };
  } catch (error) {
    throw new Error(`Failed to create test hosting: ${error.message}`);
  }
};

/**
 * Create test invoice in database
 * @param {integer} clientId - Client ID
 * @param {object} invoiceData - Invoice data
 * @returns {object} Created invoice with ID
 */
const createTestInvoice = async (clientId, invoiceData = testInvoices.invoice1) => {
  try {
    const query = `
      INSERT INTO invoices (client_id, invoice_number, total_amount, status, due_date)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      clientId,
      invoiceData.invoice_number,
      invoiceData.total_amount,
      invoiceData.status,
      invoiceData.due_date
    ]);

    return { id: result.insertId, client_id: clientId, ...invoiceData };
  } catch (error) {
    throw new Error(`Failed to create test invoice: ${error.message}`);
  }
};

/**
 * Create test support ticket in database
 * @param {integer} clientId - Client ID
 * @param {object} ticketData - Ticket data
 * @returns {object} Created ticket with ID
 */
const createTestTicket = async (clientId, ticketData = testTickets.ticket1) => {
  try {
    const query = `
      INSERT INTO support_tickets (client_id, subject, description, priority, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      clientId,
      ticketData.subject,
      ticketData.description,
      ticketData.priority,
      ticketData.status
    ]);

    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(result.insertId).padStart(5, '0')}`;
    
    await db.query('UPDATE support_tickets SET ticket_number = ? WHERE id = ?', [
      ticketNumber,
      result.insertId
    ]);

    return { id: result.insertId, client_id: clientId, ticket_number: ticketNumber, ...ticketData };
  } catch (error) {
    throw new Error(`Failed to create test ticket: ${error.message}`);
  }
};

/**
 * Create test backup in database
 * @param {integer} userId - User ID
 * @param {object} backupData - Backup data
 * @returns {object} Created backup with ID
 */
const createTestBackup = async (userId, backupData = testBackups.backup1) => {
  try {
    const query = `
      INSERT INTO backup_history (backup_name, backup_type, status, size_bytes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      backupData.backup_name,
      backupData.backup_type,
      backupData.status,
      backupData.size_bytes,
      userId
    ]);

    return { id: result.insertId, created_by: userId, ...backupData };
  } catch (error) {
    throw new Error(`Failed to create test backup: ${error.message}`);
  }
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {object} User data
 */
const getUserByEmail = async (email) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return result[0] || null;
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
};

/**
 * Get client by ID
 * @param {integer} clientId - Client ID
 * @returns {object} Client data
 */
const getClientById = async (clientId) => {
  try {
    const result = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    return result[0] || null;
  } catch (error) {
    throw new Error(`Failed to get client: ${error.message}`);
  }
};

/**
 * Generate valid JWT token for testing
 * @param {object} user - User object
 * @returns {string} JWT token
 */
const generateTestToken = (user) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'test-secret-key',
    { expiresIn: '24h' }
  );
};

/**
 * Setup test database
 */
const setupTestDatabase = async () => {
  try {
    // Create tables if they don't exist
    const schema = require('../src/config/schema');
    await schema.init();
    
    // Clear existing test data
    await clearTestData();
    
    console.log('Test database setup complete');
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
};

/**
 * Teardown test database
 */
const teardownTestDatabase = async () => {
  try {
    await clearTestData();
    console.log('Test database teardown complete');
  } catch (error) {
    console.error('Test database teardown failed:', error);
    throw error;
  }
};

module.exports = {
  testUsers,
  testClients,
  testProjects,
  testDomains,
  testHosting,
  testInvoices,
  testTickets,
  testBackups,
  
  // Database operations
  clearTestData,
  createTestUser,
  createTestClient,
  createTestProject,
  createTestDomain,
  createTestHosting,
  createTestInvoice,
  createTestTicket,
  createTestBackup,
  getUserByEmail,
  getClientById,
  
  // JWT
  generateTestToken,
  
  // Setup/Teardown
  setupTestDatabase,
  teardownTestDatabase
};
