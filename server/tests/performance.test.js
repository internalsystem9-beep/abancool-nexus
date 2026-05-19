/**
 * Performance Testing Suite
 * Tests for response times, throughput, and performance metrics
 * Load testing configuration and scenario definitions
 */

const request = require('supertest');
const app = require('../src/index');
const { setupTestDatabase, teardownTestDatabase, generateTestToken, testUsers } = require('./setup');

describe('Performance Testing Suite', () => {
  let token;
  let superAdminToken;

  beforeAll(async () => {
    await setupTestDatabase();
    token = generateTestToken(testUsers.regularUser);
    superAdminToken = generateTestToken(testUsers.superAdmin);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Response Time Tests', () => {
    it('should respond to health check under 100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should list clients under 500ms', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should retrieve single client under 300ms', async () => {
      // Create client first
      const createRes = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          companyName: 'Perf Test Company',
          email: 'perf@test.com',
          phone: '+254712345678',
          country: 'Kenya'
        });

      const clientId = createRes.body.data.id;

      const startTime = Date.now();

      const res = await request(app)
        .get(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(300);
    });

    it('should create client under 1000ms', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          companyName: 'Quick Create Test',
          email: `quick${Date.now()}@test.com`,
          phone: '+254712345678',
          country: 'Kenya'
        });

      const duration = Date.now() - startTime;
      expect(res.status).toBe(201);
      expect(duration).toBeLessThan(1000);
    });

    it('should authenticate under 500ms', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.regularUser.email,
          password: 'SecurePass123!'
        });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should query with filters under 800ms', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .get('/api/invoices?status=paid&page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(800);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle 10 sequential requests efficiently', async () => {
      const startTime = Date.now();
      const requests = [];

      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/health')
        );
      }

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      results.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Average should be under 50ms per request
      expect(duration / 10).toBeLessThan(50);
    });

    it('should handle concurrent requests without errors', async () => {
      const requests = [];

      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/clients')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      const results = await Promise.all(requests);
      const successCount = results.filter(res => res.status === 200).length;

      expect(successCount).toBe(20);
    });
  });

  describe('Database Query Performance', () => {
    it('should list 100 items with pagination efficiently', async () => {
      const startTime = Date.now();

      // Create multiple clients for pagination test
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          request(app)
            .post('/api/clients')
            .set('Authorization', `Bearer ${token}`)
            .send({
              companyName: `Batch Company ${i}`,
              email: `batch${i}@test.com`,
              phone: '+254712345678',
              country: 'Kenya'
            })
        );
      }

      await Promise.all(createPromises);

      // Query with pagination
      const res = await request(app)
        .get('/api/clients?page=1&limit=100')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should handle complex filtering efficiently', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .get('/api/invoices?status=paid&clientId=1&minAmount=0&maxAmount=10000&page=1&limit=50')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it('should optimize N+1 query issues', async () => {
      const startTime = Date.now();

      // Get all clients with their projects
      const res = await request(app)
        .get('/api/clients?include=projects&page=1&limit=20')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      // Should complete in reasonable time despite relationship loading
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during rapid operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform rapid operations
      for (let i = 0; i < 50; i++) {
        await request(app)
          .get('/api/health');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large payload efficiently', async () => {
      const largeData = {
        companyName: 'Large Payload Test',
        email: 'large@test.com',
        phone: '+254712345678',
        country: 'Kenya',
        description: 'A'.repeat(10000), // 10KB description
        metadata: JSON.stringify(Array(100).fill({ key: 'value' }))
      };

      const startTime = Date.now();

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send(largeData);

      const duration = Date.now() - startTime;
      expect(res.status).toBe(201);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Cache Performance', () => {
    it('should benefit from caching on repeated requests', async () => {
      // First request (cache miss)
      const firstStart = Date.now();
      await request(app)
        .get('/api/clients?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);
      const firstDuration = Date.now() - firstStart;

      // Second request (cache hit)
      const secondStart = Date.now();
      await request(app)
        .get('/api/clients?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);
      const secondDuration = Date.now() - secondStart;

      // Second request should be faster or equal
      expect(secondDuration).toBeLessThanOrEqual(firstDuration + 100);
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle steady state load for 5 seconds', async () => {
      const errors = [];
      const durations = [];
      const endTime = Date.now() + 5000; // 5 seconds

      while (Date.now() < endTime) {
        const startTime = Date.now();

        try {
          const res = await request(app)
            .get('/api/health');

          if (res.status !== 200) {
            errors.push(res.status);
          }

          durations.push(Date.now() - startTime);
        } catch (error) {
          errors.push(error.message);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(errors.length).toBe(0);
      expect(durations.length).toBeGreaterThan(0);

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      expect(avgDuration).toBeLessThan(100);
    });

    it('should handle spike in traffic', async () => {
      const requests = [];

      // Create spike of 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/health')
            .catch(() => ({ status: 0 }))
        );
      }

      const results = await Promise.all(requests);
      const successCount = results.filter(res => res.status === 200).length;

      // Should handle 80% success rate during spike
      expect(successCount).toBeGreaterThan(40);
    });

    it('should gracefully handle degraded performance', async () => {
      const requests = [];

      // Create sustained high load
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get('/api/clients')
            .set('Authorization', `Bearer ${token}`)
            .catch(() => ({ status: 0, body: { success: false } }))
        );
      }

      const results = await Promise.all(requests);
      const successCount = results.filter(res => res.status === 200).length;
      const failureCount = results.filter(res => res.status !== 200).length;

      // At least 50% should succeed
      expect(successCount).toBeGreaterThan(50);
      // Some may fail or timeout
      expect(failureCount).toBeLessThan(50);
    });
  });

  describe('Batch Operation Performance', () => {
    it('should process batch operations efficiently', async () => {
      const startTime = Date.now();

      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/clients')
            .set('Authorization', `Bearer ${token}`)
            .send({
              companyName: `Batch ${i}`,
              email: `batch${i}@test.com`,
              phone: '+254712345678',
              country: 'Kenya'
            })
        );
      }

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results.every(res => res.status === 201)).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete in reasonable time
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors efficiently', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          companyName: '',
          email: 'invalid-email'
        });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Validation should be fast
    });

    it('should handle 404 errors efficiently', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/clients/99999999')
        .set('Authorization', `Bearer ${token}`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(300);
    });
  });
});

// Load Testing Configuration (for use with Artillery or Autocannon)
module.exports = {
  // Artillery.io configuration
  artillery: {
    config: {
      target: 'http://localhost:4000',
      phases: [
        {
          duration: 60,
          arrivalRate: 10,
          name: 'Warm up'
        },
        {
          duration: 300,
          arrivalRate: 50,
          name: 'Steady state'
        },
        {
          duration: 60,
          arrivalRate: 100,
          name: 'Spike'
        },
        {
          duration: 60,
          arrivalRate: 10,
          name: 'Cool down'
        }
      ],
      processor: './load-test-processor.js',
      variables: {
        token: process.env.TEST_TOKEN || ''
      }
    },
    scenarios: [
      {
        name: 'Health Check',
        weight: 10,
        flow: [
          {
            get: {
              url: '/api/health'
            }
          }
        ]
      },
      {
        name: 'List Clients',
        weight: 20,
        flow: [
          {
            get: {
              url: '/api/clients?page=1&limit=10',
              headers: {
                Authorization: 'Bearer {{ token }}'
              }
            }
          }
        ]
      },
      {
        name: 'Create Client',
        weight: 5,
        flow: [
          {
            post: {
              url: '/api/clients',
              headers: {
                Authorization: 'Bearer {{ token }}'
              },
              json: {
                companyName: 'Load Test {{ $randomNumber(1, 10000) }}',
                email: 'test{{ $randomNumber(1, 10000) }}@test.com',
                phone: '+254712345678',
                country: 'Kenya'
              }
            }
          }
        ]
      },
      {
        name: 'List Invoices',
        weight: 20,
        flow: [
          {
            get: {
              url: '/api/invoices?page=1&limit=10',
              headers: {
                Authorization: 'Bearer {{ token }}'
              }
            }
          }
        ]
      }
    ]
  },

  // Autocannon configuration
  autocannon: {
    url: 'http://localhost:4000/api/health',
    connections: 10,
    pipelining: 1,
    duration: 30,
    requests: [
      {
        path: '/api/health',
        method: 'GET'
      },
      {
        path: '/api/clients?page=1&limit=10',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.TEST_TOKEN || ''}`
        }
      }
    ]
  },

  // Performance benchmarks
  benchmarks: {
    healthCheck: {
      maxResponseTime: 100,
      minThroughput: 100
    },
    listClients: {
      maxResponseTime: 500,
      minThroughput: 20
    },
    createClient: {
      maxResponseTime: 1000,
      minThroughput: 10
    },
    authentication: {
      maxResponseTime: 500,
      minThroughput: 5
    }
  }
};
