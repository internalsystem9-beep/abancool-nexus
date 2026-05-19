const request = require('supertest');
const express = require('express');
const testSetup = require('./setup');

let app;
let testUser;
let testClient;
let testProject;
let testToken;

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database
    await testSetup.setupTestDatabase();
    
    // Initialize app (in real scenario, import from server)
    app = express();
    app.use(express.json());
    
    // Create test user
    testUser = await testSetup.createTestUser(testSetup.testUsers.regularUser);
    testToken = testSetup.generateTestToken(testUser);
    
    // Create test client
    testClient = await testSetup.createTestClient(testUser.id, testSetup.testClients.client1);
    
    // Create test project
    testProject = await testSetup.createTestProject(testClient.id, testSetup.testProjects.project1);
  });

  afterAll(async () => {
    await testSetup.teardownTestDatabase();
  });

  describe('Authentication Integration', () => {
    test('should register new user', async () => {
      const newUser = {
        email: 'newuser@test.com',
        password: 'NewPassword123!',
        first_name: 'New',
        last_name: 'User',
        phone: '+254700000000'
      };

      const res = await request(app)
        .post('/api/auth/signup')
        .send(newUser)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('email', newUser.email);
    });

    test('should login user', async () => {
      const loginData = {
        email: testSetup.testUsers.regularUser.email,
        password: testSetup.testUsers.regularUser.password
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('user');
    });

    test('should reject invalid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    test('should return 401 for unauthorized requests', async () => {
      const res = await request(app)
        .get('/api/users')
        .expect('Content-Type', /json/);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('User Management Integration', () => {
    test('should get authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testUser.id);
      expect(res.body.data.email).toBe(testUser.email);
    });

    test('should list users with pagination', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=10')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });

    test('should update user profile', async () => {
      const updateData = {
        first_name: 'UpdatedName',
        last_name: 'UpdatedLast'
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('UpdatedName');
    });
  });

  describe('Client Management Integration', () => {
    test('should create new client', async () => {
      const clientData = {
        company_name: 'New Client Co',
        industry: 'Finance',
        country: 'Nigeria'
      };

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${testToken}`)
        .send(clientData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.company_name).toBe(clientData.company_name);
    });

    test('should list clients', async () => {
      const res = await request(app)
        .get('/api/clients?page=1&limit=20')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    test('should get specific client', async () => {
      const res = await request(app)
        .get(`/api/clients/${testClient.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testClient.id);
    });

    test('should update client', async () => {
      const updateData = {
        company_name: 'Updated Company Name'
      };

      const res = await request(app)
        .patch(`/api/clients/${testClient.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.company_name).toBe('Updated Company Name');
    });
  });

  describe('Project Management Integration', () => {
    test('should create new project', async () => {
      const projectData = {
        client_id: testClient.id,
        project_name: 'New Web App',
        description: 'Modern web application'
      };

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send(projectData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.project_name).toBe('New Web App');
    });

    test('should list projects', async () => {
      const res = await request(app)
        .get(`/api/clients/${testClient.id}/projects`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    test('should get specific project', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testProject.id);
    });
  });

  describe('Domain Management Integration', () => {
    test('should register domain for project', async () => {
      const domainData = {
        project_id: testProject.id,
        domain_name: 'newdomain.com',
        registrar: 'Namecheap',
        expiry_date: '2025-12-31',
        auto_renew: true
      };

      const res = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${testToken}`)
        .send(domainData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.domain_name).toBe('newdomain.com');
    });

    test('should list project domains', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.id}/domains`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Hosting Management Integration', () => {
    test('should create hosting for project', async () => {
      const hostingData = {
        project_id: testProject.id,
        hosting_type: 'shared',
        space: '100GB',
        bandwidth: 'Unlimited'
      };

      const res = await request(app)
        .post('/api/hosting')
        .set('Authorization', `Bearer ${testToken}`)
        .send(hostingData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hosting_type).toBe('shared');
    });

    test('should list project hosting', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProject.id}/hosting`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Invoice Management Integration', () => {
    test('should create invoice', async () => {
      const invoiceData = {
        client_id: testClient.id,
        invoice_number: 'INV-TEST-001',
        total_amount: 5000.00,
        due_date: '2024-06-30'
      };

      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invoiceData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice_number).toBe('INV-TEST-001');
    });

    test('should list invoices', async () => {
      const res = await request(app)
        .get(`/api/clients/${testClient.id}/invoices`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Support Ticket Integration', () => {
    test('should create support ticket', async () => {
      const ticketData = {
        client_id: testClient.id,
        subject: 'Website Down',
        description: 'Website is not responding',
        priority: 'critical'
      };

      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(ticketData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.subject).toBe('Website Down');
      expect(res.body.data).toHaveProperty('ticket_number');
    });

    test('should list tickets', async () => {
      const res = await request(app)
        .get('/api/tickets?page=1&limit=20')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Backup Integration', () => {
    test('should create backup', async () => {
      const backupData = {
        backup_name: 'Manual Backup',
        backup_type: 'full',
        project_id: testProject.id
      };

      const res = await request(app)
        .post('/api/backups')
        .set('Authorization', `Bearer ${testToken}`)
        .send(backupData)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data.backup_name).toBe('Manual Backup');
    });

    test('should list backups', async () => {
      const res = await request(app)
        .get('/api/backups?page=1&limit=20')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling Integration', () => {
    test('should return 404 for non-existent resource', async () => {
      const res = await request(app)
        .get('/api/clients/99999')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('NOT_FOUND');
    });

    test('should return 400 for validation error', async () => {
      const invalidData = {
        company_name: '', // Empty required field
        industry: 'Tech'
      };

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect('Content-Type', /json/);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toMatch(/VALIDATION|MISSING/);
    });

    test('should return 403 for permission denied', async () => {
      // Create a different user
      const otherUser = await testSetup.createTestUser({
        ...testSetup.testUsers.regularUser,
        email: 'other@test.com'
      });
      const otherToken = testSetup.generateTestToken(otherUser);

      // Try to access testClient created by testUser
      const res = await request(app)
        .patch(`/api/clients/${testClient.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ company_name: 'Hacked' })
        .expect('Content-Type', /json/);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toMatch(/PERMISSION|AUTHORIZATION/);
    });
  });

  describe('Pagination Integration', () => {
    test('should paginate results correctly', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=5')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
      expect(res.body.pagination.pages).toBeGreaterThanOrEqual(0);
    });

    test('should enforce pagination limits', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=1000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      // Should enforce max limit (e.g., 100)
      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('Response Format Integration', () => {
    test('should return consistent response format for success', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.status).toBe(200);
    });

    test('should return consistent response format for errors', async () => {
      const res = await request(app)
        .get('/api/clients/99999')
        .set('Authorization', `Bearer ${testToken}`)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('success');
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('errorCode');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Content Type Integration', () => {
    test('all responses should be JSON', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('CORS Integration', () => {
    test('should handle CORS preflight requests', async () => {
      const res = await request(app)
        .options('/api/users/profile')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(200);
    });
  });

  describe('Security Integration', () => {
    test('should not expose server details', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('should include security headers', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });
});
