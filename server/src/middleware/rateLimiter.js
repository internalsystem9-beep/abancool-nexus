const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

/**
 * Redis client for rate limiting (optional)
 * Falls back to memory store if Redis not available
 */
let redisClient = null;

try {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  });
  redisClient.on('error', () => {
    redisClient = null; // Disable Redis on error
  });
} catch (error) {
  // Redis not available, use memory store
  redisClient = null;
}

/**
 * Create rate limit store configuration
 * Uses Redis if available, otherwise memory
 */
const createStore = (options) => {
  if (redisClient && redisClient.connected) {
    return new RedisStore({
      client: redisClient,
      prefix: `rl:${options.prefix}:`,
      expiry: options.windowMs / 1000
    });
  }
  
  // Fallback to memory store
  return undefined; // express-rate-limit uses memory by default
};

/**
 * Error handler for rate limit
 */
const rateLimitErrorHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    retryAfter: req.rateLimit.resetTime
  });
};

/**
 * Key generator for rate limiting
 * Uses user ID if authenticated, otherwise IP
 */
const keyGenerator = (req) => {
  return req.user?.id || req.ip;
};

/**
 * Skip function to exclude certain requests
 */
const skipFailedRequests = (req, res) => {
  return res.statusCode < 400;
};

/**
 * General API Rate Limit
 * Default limit for all API endpoints: 100 requests per 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/api/health') return true;
    return false;
  }
});

/**
 * Authentication Rate Limit
 * Stricter limit for auth endpoints: 5 requests per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: (req) => req.ip, // Always use IP for auth
  skipSuccessfulRequests: false
});

/**
 * OTP Verification Rate Limit
 * Limit OTP verification attempts: 3 per 5 minutes
 */
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many OTP verification attempts. Please try again after 5 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: true // Don't count successful attempts
});

/**
 * Create Account Rate Limit
 * Prevent account creation spam: 5 accounts per day per IP
 */
const createAccountLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many accounts created from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false
});

/**
 * Password Reset Rate Limit
 * Prevent password reset abuse: 3 attempts per hour
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many password reset attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: (req) => req.ip,
  skipSuccessfulRequests: false
});

/**
 * Download Rate Limit
 * Prevent bulk downloads: 20 per hour per user
 */
const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 requests per windowMs
  message: 'Too many downloads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * File Upload Rate Limit
 * Prevent bulk uploads: 10 per hour per user
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 requests per windowMs
  message: 'Too many uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Database Query Rate Limit
 * Protect database: 500 queries per 5 minutes per user
 */
const databaseLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // limit each user to 500 requests per windowMs
  message: 'Too many database queries. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Backup Rate Limit
 * Prevent excessive backups: 5 per day
 */
const backupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // limit each user to 5 requests per windowMs
  message: 'Too many backup requests. Please try again tomorrow.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Support Ticket Rate Limit
 * Prevent spam tickets: 10 per hour
 */
const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 requests per windowMs
  message: 'Too many support tickets created. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Email Sending Rate Limit
 * Prevent email spam: 50 emails per day per user
 */
const emailLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50, // limit each user to 50 requests per windowMs
  message: 'Too many emails sent. Please try again tomorrow.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * API Key Rate Limit
 * Strict limit for API key endpoints: 50 per hour
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each user to 50 requests per windowMs
  message: 'Too many API key operations. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Payment Rate Limit
 * Protect payments: 20 transactions per hour
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 requests per windowMs
  message: 'Too many payment attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler,
  keyGenerator: keyGenerator,
  skipSuccessfulRequests: false
});

/**
 * Create custom rate limiter
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Maximum requests per window
 * @param {string} message - Error message
 * @returns {Function} Rate limit middleware
 */
const createCustomLimiter = (windowMs, max, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitErrorHandler,
    keyGenerator: keyGenerator,
    skipSuccessfulRequests: false
  });
};

/**
 * Combine multiple rate limiters
 * Applies all limiters in sequence
 * @param {...Function} limiters - Rate limit middleware functions
 * @returns {Function} Combined middleware
 */
const combineLimiters = (...limiters) => {
  return (req, res, next) => {
    let index = 0;

    const nextLimiter = () => {
      if (index < limiters.length) {
        const limiter = limiters[index++];
        limiter(req, res, nextLimiter);
      } else {
        next();
      }
    };

    nextLimiter();
  };
};

module.exports = {
  // Limiters
  apiLimiter,
  authLimiter,
  otpLimiter,
  createAccountLimiter,
  passwordResetLimiter,
  downloadLimiter,
  uploadLimiter,
  databaseLimiter,
  backupLimiter,
  ticketLimiter,
  emailLimiter,
  apiKeyLimiter,
  paymentLimiter,
  
  // Utilities
  createCustomLimiter,
  combineLimiters,
  rateLimitErrorHandler,
  keyGenerator,
  skipFailedRequests
};
