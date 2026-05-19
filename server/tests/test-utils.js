/**
 * Test Utilities and Helpers
 * Reusable test functions, mocks, fixtures, and assertion helpers
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Database utilities
 */
const dbUtils = {
  /**
   * Get total record count for a table
   */
  async getTableCount(tableName) {
    const query = `SELECT COUNT(*) as count FROM ${tableName}`;
    // Implement with your database connection
    return 0;
  },

  /**
   * Clear all tables in sequence respecting foreign keys
   */
  async clearAllTables() {
    const tables = [
      'sessions',
      'user_roles',
      'users',
      'clients',
      'projects',
      'domains',
      'hosting',
      'invoices',
      'support_tickets'
    ];

    for (const table of tables) {
      // Implement with your database connection
    }
  },

  /**
   * Create indexed data for performance testing
   */
  async createIndexedData(table, records) {
    // Implement bulk insert
  }
};

/**
 * JWT utilities
 */
const jwtUtils = {
  /**
   * Generate token with custom claims
   */
  generateToken(payload, secret = process.env.JWT_SECRET, expiresIn = '24h') {
    return jwt.sign(payload, secret, { expiresIn });
  },

  /**
   * Generate token that expires soon
   */
  generateExpiredToken(payload, secret = process.env.JWT_SECRET) {
    return jwt.sign(payload, secret, { expiresIn: '-1h' });
  },

  /**
   * Generate token with invalid signature
   */
  generateInvalidToken(payload) {
    return jwt.sign(payload, 'wrong-secret', { expiresIn: '24h' });
  },

  /**
   * Decode token without verification
   */
  decodeToken(token) {
    return jwt.decode(token);
  },

  /**
   * Verify token validity
   */
  verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }
};

/**
 * Mock data generators
 */
const mockDataGenerator = {
  /**
   * Generate random email
   */
  generateEmail() {
    return `user${Math.random().toString(36).substr(2, 9)}@test.com`;
  },

  /**
   * Generate random phone number
   */
  generatePhone() {
    return `+254${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
  },

  /**
   * Generate random company name
   */
  generateCompanyName() {
    const adjectives = ['Tech', 'Smart', 'Digital', 'Future', 'Cloud'];
    const nouns = ['Solutions', 'Systems', 'Services', 'Labs', 'Innovations'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  },

  /**
   * Generate random domain name
   */
  generateDomain() {
    const name = Math.random().toString(36).substr(2, 8);
    const tlds = ['com', 'ke', 'io', 'org', 'net'];
    return `${name}.${tlds[Math.floor(Math.random() * tlds.length)]}`;
  },

  /**
   * Generate random amount
   */
  generateAmount(min = 100, max = 10000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Generate random date in future
   */
  generateFutureDate(daysAhead = 30) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString();
  },

  /**
   * Generate valid JWT token
   */
  generateValidToken(userId, role = 'user') {
    return jwtUtils.generateToken({
      id: userId,
      email: `user${userId}@test.com`,
      role: role
    });
  }
};

/**
 * Assertion helpers
 */
const assertionHelpers = {
  /**
   * Assert response has standard structure
   */
  assertStandardResponse(response) {
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('timestamp');
    expect(typeof response.timestamp).toBe('string');
    return true;
  },

  /**
   * Assert successful response
   */
  assertSuccessResponse(response) {
    this.assertStandardResponse(response);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('data');
    return true;
  },

  /**
   * Assert error response
   */
  assertErrorResponse(response) {
    this.assertStandardResponse(response);
    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response).toHaveProperty('errorCode');
    return true;
  },

  /**
   * Assert pagination structure
   */
  assertPaginationStructure(pagination) {
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('hasNextPage');
    expect(pagination).toHaveProperty('hasPreviousPage');
    return true;
  },

  /**
   * Assert list response
   */
  assertListResponse(response) {
    this.assertSuccessResponse(response);
    expect(Array.isArray(response.data)).toBe(true);
    this.assertPaginationStructure(response.pagination);
    return true;
  },

  /**
   * Assert HTTP status code
   */
  assertStatusCode(response, expectedCode) {
    expect(response.status).toBe(expectedCode);
    return true;
  },

  /**
   * Assert header exists
   */
  assertHeaderExists(response, headerName) {
    expect(response.headers[headerName.toLowerCase()]).toBeDefined();
    return true;
  }
};

/**
 * Performance measurement utilities
 */
const performanceUtils = {
  /**
   * Measure execution time
   */
  async measureTime(fn) {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  /**
   * Measure multiple executions
   */
  async measureMultiple(fn, iterations = 10) {
    const durations = [];
    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureTime(fn);
      durations.push(duration);
    }
    return {
      durations,
      average: durations.reduce((a, b) => a + b) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      total: durations.reduce((a, b) => a + b)
    };
  },

  /**
   * Assert response time
   */
  assertResponseTime(duration, maxDuration) {
    expect(duration).toBeLessThan(maxDuration);
    return true;
  }
};

/**
 * Mocking utilities
 */
const mockUtils = {
  /**
   * Mock external API response
   */
  mockApiResponse(status = 200, data = {}) {
    return {
      status,
      data,
      headers: {
        'content-type': 'application/json'
      }
    };
  },

  /**
   * Mock database connection
   */
  mockDatabase() {
    return {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn(),
      close: jest.fn()
    };
  },

  /**
   * Mock email service
   */
  mockEmailService() {
    return {
      send: jest.fn().mockResolvedValue({ success: true }),
      sendBatch: jest.fn().mockResolvedValue({ success: true })
    };
  },

  /**
   * Mock SMS service
   */
  mockSmsService() {
    return {
      send: jest.fn().mockResolvedValue({ success: true, messageId: 'SMS123' }),
      sendBatch: jest.fn().mockResolvedValue({ success: true })
    };
  },

  /**
   * Mock payment gateway
   */
  mockPaymentGateway() {
    return {
      initiatePayment: jest.fn().mockResolvedValue({ success: true, transactionId: 'TRX123' }),
      verifyPayment: jest.fn().mockResolvedValue({ success: true, status: 'completed' })
    };
  }
};

/**
 * Data validation utilities
 */
const validationUtils = {
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  /**
   * Validate phone format
   */
  isValidPhone(phone) {
    const regex = /^\+?[1-9]\d{1,14}$/;
    return regex.test(phone);
  },

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate ISO date
   */
  isValidDate(date) {
    return !isNaN(new Date(date).getTime());
  },

  /**
   * Validate UUID
   */
  isValidUuid(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  },

  /**
   * Validate strong password
   */
  isStrongPassword(password) {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }
};

/**
 * Test data cleanup utilities
 */
const cleanupUtils = {
  /**
   * Cleanup all test files
   */
  async cleanupTestFiles() {
    // Implementation for file cleanup
  },

  /**
   * Cleanup test database entries
   */
  async cleanupTestData(tableName) {
    // Implementation for database cleanup
  },

  /**
   * Cleanup test sessions
   */
  async cleanupSessions() {
    // Implementation for session cleanup
  }
};

/**
 * Retry logic utilities
 */
const retryUtils = {
  /**
   * Retry failed operations
   */
  async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      delay = 100,
      backoff = 1.5,
      shouldRetry = () => true
    } = options;

    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!shouldRetry(error) || attempt === maxAttempts - 1) {
          throw error;
        }

        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }
};

/**
 * Request helper utilities
 */
const requestUtils = {
  /**
   * Build query string
   */
  buildQueryString(params) {
    return new URLSearchParams(params).toString();
  },

  /**
   * Build authorization header
   */
  buildAuthHeader(token) {
    return `Bearer ${token}`;
  },

  /**
   * Build headers object
   */
  buildHeaders(token = null) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = this.buildAuthHeader(token);
    }

    return headers;
  }
};

/**
 * Fixtures loader
 */
const fixturesLoader = {
  /**
   * Load fixture file
   */
  loadFixture(name) {
    // Implementation to load fixture from file
    return {};
  },

  /**
   * Load multiple fixtures
   */
  loadFixtures(...names) {
    return names.reduce((acc, name) => {
      acc[name] = this.loadFixture(name);
      return acc;
    }, {});
  }
};

module.exports = {
  dbUtils,
  jwtUtils,
  mockDataGenerator,
  assertionHelpers,
  performanceUtils,
  mockUtils,
  validationUtils,
  cleanupUtils,
  retryUtils,
  requestUtils,
  fixturesLoader
};
