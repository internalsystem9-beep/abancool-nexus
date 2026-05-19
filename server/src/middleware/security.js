const helmet = require('helmet');
const cors = require('cors');

/**
 * Helmet Security Middleware Configuration
 * Provides comprehensive HTTP security headers
 */
const helmetConfig = helmet({
  // Control caching behavior
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // Prevent clickjacking
  frameguard: {
    action: 'deny'
  },
  // XSS Protection header
  xssFilter: true,
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  // Remove powered by header
  hidePoweredBy: true,
  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },
  // Feature Policy / Permissions Policy
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"]
    }
  }
});

/**
 * CORS Configuration
 * Controls cross-origin resource sharing
 */
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:4000'
        ];

    // Allow requests with no origin (like mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
};

/**
 * Apply Helmet middleware
 * @param {Express.Application} app - Express app instance
 */
const applyHelmet = (app) => {
  app.use(helmetConfig);
};

/**
 * Apply CORS middleware
 * @param {Express.Application} app - Express app instance
 */
const applyCors = (app) => {
  app.use(cors(corsConfig));
  // Handle preflight requests
  app.options('*', cors(corsConfig));
};

/**
 * Security Headers Middleware
 * Additional custom security headers
 */
const securityHeaders = (req, res, next) => {
  // Prevent browser caching of sensitive content
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent HTTP trace/track methods
  res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  // Add custom security header
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

/**
 * HTTPS Redirect Middleware
 * Force HTTPS in production
 */
const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  } else {
    next();
  }
};

/**
 * Request Size Limit Middleware
 * Prevent large payload attacks
 */
const requestSizeLimit = {
  json: { limit: '10mb' },
  urlencoded: { limit: '10mb', extended: true },
  raw: { limit: '10mb' }
};

/**
 * Request Timeout Middleware
 * Prevent slow client attacks
 */
const requestTimeout = (req, res, next) => {
  // Set request timeout to 30 seconds
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // Handle timeout
  req.on('timeout', () => {
    res.status(408).json({
      success: false,
      error: 'Request timeout',
      errorCode: 'REQUEST_TIMEOUT'
    });
  });
  
  next();
};

/**
 * IP Whitelist/Blacklist Middleware
 * Control access by IP address
 */
const ipControl = () => {
  const whitelist = process.env.IP_WHITELIST
    ? process.env.IP_WHITELIST.split(',')
    : [];
  const blacklist = process.env.IP_BLACKLIST
    ? process.env.IP_BLACKLIST.split(',')
    : [];

  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;

    if (blacklist.length > 0 && blacklist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: 'IP address is blocked',
        errorCode: 'IP_BLOCKED'
      });
    }

    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: 'IP address is not whitelisted',
        errorCode: 'IP_NOT_WHITELISTED'
      });
    }

    next();
  };
};

/**
 * Request ID Middleware
 * Add unique request ID for tracking
 */
const requestId = (req, res, next) => {
  const uuid = require('crypto').randomUUID();
  req.id = uuid;
  req.requestId = uuid;
  res.setHeader('X-Request-ID', uuid);
  next();
};

/**
 * Security Audit Logging Middleware
 * Log security-relevant events
 */
const securityAuditLog = (req, res, next) => {
  // Skip logging for health checks
  if (req.path === '/api/health') {
    return next();
  }

  res.on('finish', () => {
    const statusCode = res.statusCode;
    
    // Log failed auth attempts
    if (statusCode === 401 || statusCode === 403) {
      const logData = {
        timestamp: new Date(),
        requestId: req.id,
        path: req.path,
        method: req.method,
        statusCode: statusCode,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id || null
      };

      // In production, send to security monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Log to monitoring service
      }
    }
  });

  next();
};

/**
 * Apply all security middleware
 * @param {Express.Application} app - Express app instance
 */
const applySecurity = (app) => {
  // Helmet first for headers
  applyHelmet(app);

  // CORS configuration
  applyCors(app);

  // Custom security headers
  app.use(securityHeaders);

  // HTTPS redirect
  app.use(httpsRedirect);

  // Request timeout
  app.use(requestTimeout);

  // Request ID
  app.use(requestId);

  // Security audit logging
  app.use(securityAuditLog);

  // Note: IP control disabled by default, enable with environment variables
  // app.use(ipControl());
};

module.exports = {
  applySecurity,
  applyHelmet,
  applyCors,
  securityHeaders,
  httpsRedirect,
  requestTimeout,
  requestId,
  securityAuditLog,
  ipControl,
  helmetConfig,
  corsConfig,
  requestSizeLimit
};
