const request = require('supertest');
const express = require('express');
const { createServer } = require('http');

// Security utilities and middleware
const {
  applySecurity,
  helmetConfig,
  corsConfig
} = require('../src/middleware/security');
const {
  apiLimiter,
  authLimiter,
  createAccountLimiter,
  passwordResetLimiter,
  combineLimiters
} = require('../src/middleware/rateLimiter');
const securityUtils = require('../src/utils/security');

let app;
let server;

describe('Security Implementation Tests', () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Apply security middleware
    applySecurity(app);

    // Test routes
    app.post('/api/auth/login', authLimiter, (req, res) => {
      res.json({ success: true, message: 'Login successful' });
    });

    app.post('/api/auth/signup', createAccountLimiter, (req, res) => {
      res.json({ success: true, message: 'Account created' });
    });

    app.post('/api/auth/password-reset', passwordResetLimiter, (req, res) => {
      res.json({ success: true, message: 'Password reset sent' });
    });

    app.get('/api/test', apiLimiter, (req, res) => {
      res.json({ success: true, message: 'Test endpoint' });
    });

    app.get('/api/health', (req, res) => {
      res.json({ success: true, message: 'Health check' });
    });

    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Helmet Security Headers', () => {
    test('should set Strict-Transport-Security header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    test('should set X-Frame-Options header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    test('should set X-Content-Type-Options header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should set X-XSS-Protection header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-xss-protection']).toBeDefined();
    });

    test('should set Referrer-Policy header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['referrer-policy']).toBeDefined();
    });

    test('should set Content-Security-Policy header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    test('should not expose powered-by header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS Configuration', () => {
    test('should allow preflight requests', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
    });

    test('should include CORS headers in response', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    test('should include allowed methods in CORS headers', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    test('should include allowed headers in CORS response', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  describe('Custom Security Headers', () => {
    test('should include Cache-Control header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['cache-control']).toContain('no-store');
    });

    test('should include Pragma header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['pragma']).toBe('no-cache');
    });

    test('should include Expires header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['expires']).toBe('0');
    });

    test('should include X-Request-ID header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Rate Limiting - Authentication', () => {
    test('should allow auth attempts', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(res.status).not.toBe(429);
    });

    test('should limit auth attempts after threshold', async () => {
      // Make 5 requests first (limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      // 6th request should be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(res.status).toBe(429);
      expect(res.body.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('rate limit error should include retry information', async () => {
      // Trigger rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      expect(res.body.retryAfter).toBeDefined();
    });
  });

  describe('Rate Limiting - Account Creation', () => {
    test('should limit account creation', async () => {
      // Make 5 requests (limit for 24 hours)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: `test${i}@example.com`,
            password: 'Password123!',
            name: 'Test User'
          });
      }

      // 6th request should be rate limited
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test6@example.com',
          password: 'Password123!',
          name: 'Test User'
        });

      expect(res.status).toBe(429);
    });
  });

  describe('Rate Limiting - Password Reset', () => {
    test('should limit password reset attempts', async () => {
      // Make 3 requests (limit)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/password-reset')
          .send({ email: 'test@example.com' });
      }

      // 4th request should be rate limited
      const res = await request(app)
        .post('/api/auth/password-reset')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(429);
    });
  });

  describe('General API Rate Limiting', () => {
    test('should allow API requests within limit', async () => {
      const res = await request(app).get('/api/test');
      expect(res.status).not.toBe(429);
    });

    test('should include RateLimit headers', async () => {
      const res = await request(app).get('/api/test');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should detect basic SQL injection patterns', () => {
      const malicious = "' OR '1'='1";
      expect(securityUtils.detectSqlInjection(malicious)).toBe(true);
    });

    test('should detect SQL keywords', () => {
      const malicious = "'; DROP TABLE users; --";
      expect(securityUtils.detectSqlInjection(malicious)).toBe(true);
    });

    test('should escape SQL special characters', () => {
      const input = "O'Brien";
      const escaped = securityUtils.escapeSql(input);
      expect(escaped).toBe("O''Brien");
    });

    test('should escape backslashes in SQL', () => {
      const input = "C:\\path\\to\\file";
      const escaped = securityUtils.escapeSql(input);
      expect(escaped).toContain('\\\\');
    });
  });

  describe('XSS Prevention', () => {
    test('should detect script tags', () => {
      const malicious = '<script>alert("xss")</script>';
      expect(securityUtils.detectXss(malicious)).toBe(true);
    });

    test('should detect event handlers', () => {
      const malicious = '<img src=x onerror="alert(\'xss\')">';
      expect(securityUtils.detectXss(malicious)).toBe(true);
    });

    test('should detect javascript protocol', () => {
      const malicious = '<a href="javascript:alert(\'xss\')">link</a>';
      expect(securityUtils.detectXss(malicious)).toBe(true);
    });

    test('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const escaped = securityUtils.escapeHtml(input);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    test('should remove HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const cleaned = securityUtils.removeHtmlTags(input);
      expect(cleaned).toBe('Hello World');
    });
  });

  describe('Command Injection Prevention', () => {
    test('should detect command injection patterns', () => {
      const malicious = 'file.txt; rm -rf /';
      expect(securityUtils.detectCommandInjection(malicious)).toBe(true);
    });

    test('should escape command line arguments', () => {
      const input = 'file"test.txt';
      const escaped = securityUtils.escapeCommand(input);
      expect(escaped).toContain('\\"');
    });
  });

  describe('Path Traversal Prevention', () => {
    test('should detect path traversal attempts', () => {
      const malicious = '../../etc/passwd';
      expect(securityUtils.detectPathTraversal(malicious)).toBe(true);
    });

    test('should detect encoded path traversal', () => {
      const malicious = '%2e%2e%2fetc%2fpasswd';
      expect(securityUtils.detectPathTraversal(malicious)).toBe(true);
    });

    test('should normalize file paths safely', () => {
      const filePath = '../../etc/passwd';
      const baseDir = '/var/www/uploads';
      const normalized = securityUtils.normalizeFilePath(filePath, baseDir);
      expect(normalized.startsWith(baseDir) || normalized === baseDir).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize string inputs', () => {
      const input = '<script>alert("xss")</script>   ';
      const sanitized = securityUtils.sanitizeString(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('alert("xss")');
    });

    test('should sanitize object recursively', () => {
      const obj = {
        name: '<p>Test</p>',
        email: '  test@example.com  ',
        nested: {
          value: '<img src=x>'
        }
      };
      const sanitized = securityUtils.sanitizeObject(obj);
      expect(sanitized.name).not.toContain('<p>');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.nested.value).not.toContain('<img');
    });

    test('should sanitize filenames', () => {
      const filename = '../../etc/passwd<script>.txt';
      const sanitized = securityUtils.sanitizeFilename(filename);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    test('should sanitize email addresses', () => {
      const email = '  Test@Example.COM  ';
      const sanitized = securityUtils.sanitizeEmail(email);
      expect(sanitized).toBe('test@example.com');
    });

    test('should validate and sanitize URLs', () => {
      const validUrl = 'https://example.com/path?query=value';
      const sanitized = securityUtils.sanitizeUrl(validUrl);
      expect(sanitized).toBe(validUrl);
    });

    test('should reject invalid URLs', () => {
      const invalidUrl = 'javascript:alert("xss")';
      const sanitized = securityUtils.sanitizeUrl(invalidUrl);
      expect(sanitized).toBe('');
    });
  });

  describe('Encoding/Decoding', () => {
    test('should encode string to hex', () => {
      const input = 'Hello';
      const encoded = securityUtils.encodeHex(input);
      expect(encoded).toBe('48656c6c6f');
    });

    test('should decode hex string', () => {
      const hex = '48656c6c6f';
      const decoded = securityUtils.decodeHex(hex);
      expect(decoded).toBe('Hello');
    });

    test('should encode string to base64', () => {
      const input = 'Hello';
      const encoded = securityUtils.encodeBase64(input);
      expect(encoded).toBe('SGVsbG8=');
    });

    test('should decode base64 string', () => {
      const base64 = 'SGVsbG8=';
      const decoded = securityUtils.decodeBase64(base64);
      expect(decoded).toBe('Hello');
    });
  });

  describe('Request ID Generation', () => {
    test('should add request ID to response headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      // UUID format check
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Response Content-Type', () => {
    test('should return JSON content-type', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('Health Check Skip', () => {
    test('should skip rate limiting for health checks', async () => {
      // Make multiple requests
      for (let i = 0; i < 10; i++) {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle non-string inputs safely', () => {
      expect(securityUtils.detectSqlInjection(123)).toBe(false);
      expect(securityUtils.detectXss(null)).toBe(false);
      expect(securityUtils.sanitizeString({})).toEqual({});
    });

    test('should handle empty strings', () => {
      expect(securityUtils.escapeHtml('')).toBe('');
      expect(securityUtils.removeHtmlTags('')).toBe('');
      expect(securityUtils.sanitizeString('')).toBe('');
    });

    test('should handle unicode characters', () => {
      const input = 'Hello 世界 🌍';
      const sanitized = securityUtils.sanitizeString(input);
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('世界');
    });

    test('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const sanitized = securityUtils.sanitizeString(longString, { maxLength: 100 });
      expect(sanitized.length).toBe(100);
    });
  });

  describe('Security Middleware Integration', () => {
    test('should apply multiple security middlewares in order', async () => {
      const res = await request(app).get('/api/health');
      
      // Should have all security headers
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBeDefined();
      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });
});
