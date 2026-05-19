const crypto = require('crypto');

/**
 * SQL Injection Prevention Utilities
 */

/**
 * Detect SQL injection patterns
 * @param {string} input - Input string to check
 * @returns {boolean} True if SQL injection pattern detected
 */
const detectSqlInjection = (input) => {
  if (typeof input !== 'string') return false;

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/gi,
    /('|(--|#|\/\*|\*\/|xp_|sp_))/gi,
    /(;|'|"|\*|%|_|\\)/g
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Escape SQL special characters
 * @param {string} input - Input string to escape
 * @returns {string} Escaped string
 */
const escapeSql = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/"/g, '\\"')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
};

/**
 * XSS Prevention Utilities
 */

/**
 * HTML escape for XSS prevention
 * @param {string} input - Input string to escape
 * @returns {string} HTML escaped string
 */
const escapeHtml = (input) => {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };

  return input.replace(/[&<>"'\/]/g, char => map[char]);
};

/**
 * Remove HTML tags from string
 * @param {string} input - Input string
 * @returns {string} String without HTML tags
 */
const removeHtmlTags = (input) => {
  if (typeof input !== 'string') return input;
  
  return input.replace(/<[^>]*>/g, '').trim();
};

/**
 * Detect XSS patterns
 * @param {string} input - Input string to check
 * @returns {boolean} True if XSS pattern detected
 */
const detectXss = (input) => {
  if (typeof input !== 'string') return false;

  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};

/**
 * Command Injection Prevention
 */

/**
 * Detect command injection patterns
 * @param {string} input - Input string to check
 * @returns {boolean} True if command injection pattern detected
 */
const detectCommandInjection = (input) => {
  if (typeof input !== 'string') return false;

  const commandPatterns = [
    /[;&|`$(){}[\]<>]/g,
    /(\|\||&&|;|`)/g,
    /\$\{/g,
    /`/g
  ];

  return commandPatterns.some(pattern => pattern.test(input));
};

/**
 * Escape command line special characters
 * @param {string} input - Input string to escape
 * @returns {string} Escaped string
 */
const escapeCommand = (input) => {
  if (typeof input !== 'string') return input;
  
  // Wrap in quotes and escape existing quotes
  return `"${input.replace(/"/g, '\\"')}"`;
};

/**
 * Path Traversal Prevention
 */

/**
 * Detect path traversal attempts
 * @param {string} input - Input string to check
 * @returns {boolean} True if path traversal pattern detected
 */
const detectPathTraversal = (input) => {
  if (typeof input !== 'string') return false;

  const pathPatterns = [
    /\.\./g,
    /\.\/\.\./g,
    /\.\.%2[fF]/g,
    /\.%2[fE]/g,
    /%2e%2e/gi,
    /file:\/\//gi
  ];

  return pathPatterns.some(pattern => pattern.test(input));
};

/**
 * Normalize file path to prevent traversal
 * @param {string} filePath - File path to normalize
 * @param {string} baseDir - Base directory
 * @returns {string} Normalized path
 */
const normalizeFilePath = (filePath, baseDir = '/') => {
  if (typeof filePath !== 'string') return baseDir;
  
  const path = require('path');
  
  // Resolve to absolute path
  const resolved = path.resolve(baseDir, filePath);
  
  // Ensure it's within base directory
  if (!resolved.startsWith(path.resolve(baseDir))) {
    return baseDir;
  }
  
  return resolved;
};

/**
 * Input Encoding/Decoding
 */

/**
 * Encode string to hex
 * @param {string} input - Input string
 * @returns {string} Hex encoded string
 */
const encodeHex = (input) => {
  if (typeof input !== 'string') return input;
  return Buffer.from(input).toString('hex');
};

/**
 * Decode hex string
 * @param {string} input - Hex encoded string
 * @returns {string} Decoded string
 */
const decodeHex = (input) => {
  if (typeof input !== 'string') return input;
  try {
    return Buffer.from(input, 'hex').toString('utf-8');
  } catch {
    return input;
  }
};

/**
 * Encode string to base64
 * @param {string} input - Input string
 * @returns {string} Base64 encoded string
 */
const encodeBase64 = (input) => {
  if (typeof input !== 'string') return input;
  return Buffer.from(input).toString('base64');
};

/**
 * Decode base64 string
 * @param {string} input - Base64 encoded string
 * @returns {string} Decoded string
 */
const decodeBase64 = (input) => {
  if (typeof input !== 'string') return input;
  try {
    return Buffer.from(input, 'base64').toString('utf-8');
  } catch {
    return input;
  }
};

/**
 * Sanitization Functions
 */

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized string
 */
const sanitizeString = (input, options = {}) => {
  if (typeof input !== 'string') return input;

  const {
    removeHtml = true,
    trim = true,
    lowercase = false,
    removeSpecialChars = false,
    maxLength = null
  } = options;

  let result = input;

  // Remove HTML tags
  if (removeHtml) {
    result = removeHtmlTags(result);
  }

  // Trim whitespace
  if (trim) {
    result = result.trim();
  }

  // Convert to lowercase
  if (lowercase) {
    result = result.toLowerCase();
  }

  // Remove special characters
  if (removeSpecialChars) {
    result = result.replace(/[^a-zA-Z0-9\s_-]/g, '');
  }

  // Enforce max length
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result;
};

/**
 * Sanitize object recursively
 * @param {object} obj - Object to sanitize
 * @param {object} options - Sanitization options
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj, options = {}) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key
    const sanitizedKey = sanitizeString(key, { removeHtml: true, trim: true });

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value, options);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value, options);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize file name
 * @param {string} filename - File name to sanitize
 * @returns {string} Sanitized file name
 */
const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return 'file';

  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .substring(0, 255);
};

/**
 * Sanitize URL
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
const sanitizeUrl = (url) => {
  if (typeof url !== 'string') return '';

  try {
    const parsedUrl = new URL(url);
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }
    return parsedUrl.toString();
  } catch {
    return '';
  }
};

/**
 * Sanitize email
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';

  const sanitized = email.toLowerCase().trim();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
};

/**
 * Input Validation Middleware Factory
 */

/**
 * Create sanitization middleware
 * @param {object} options - Sanitization options
 * @returns {Function} Express middleware
 */
const createSanitizationMiddleware = (options = {}) => {
  return (req, res, next) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, options);
    }

    // Sanitize query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, options);
    }

    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, options);
    }

    next();
  };
};

/**
 * Create validation middleware for specific field
 * @param {string} fieldName - Field name to validate
 * @param {object} options - Validation options
 * @returns {Function} Express middleware
 */
const createFieldValidator = (fieldName, options = {}) => {
  const {
    type = 'string',
    required = false,
    minLength = 0,
    maxLength = Infinity,
    pattern = null,
    enum: allowedValues = null,
    custom = null
  } = options;

  return (req, res, next) => {
    const value = req.body?.[fieldName] || req.query?.[fieldName] || req.params?.[fieldName];

    // Check required
    if (required && (value === undefined || value === null || value === '')) {
      return res.status(400).json({
        success: false,
        error: `${fieldName} is required`,
        errorCode: 'MISSING_FIELD'
      });
    }

    if (value === undefined || value === null) {
      return next();
    }

    // Type check
    if (typeof value !== type) {
      return res.status(400).json({
        success: false,
        error: `${fieldName} must be a ${type}`,
        errorCode: 'INVALID_FIELD'
      });
    }

    // Length check for strings
    if (type === 'string') {
      if (value.length < minLength || value.length > maxLength) {
        return res.status(400).json({
          success: false,
          error: `${fieldName} must be between ${minLength} and ${maxLength} characters`,
          errorCode: 'INVALID_FIELD'
        });
      }

      // Pattern check
      if (pattern && !pattern.test(value)) {
        return res.status(400).json({
          success: false,
          error: `${fieldName} format is invalid`,
          errorCode: 'INVALID_FIELD'
        });
      }
    }

    // Enum check
    if (allowedValues && !allowedValues.includes(value)) {
      return res.status(400).json({
        success: false,
        error: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        errorCode: 'INVALID_ENUM'
      });
    }

    // Custom validation
    if (custom && typeof custom === 'function') {
      const customResult = custom(value);
      if (customResult !== true) {
        return res.status(400).json({
          success: false,
          error: customResult || `${fieldName} validation failed`,
          errorCode: 'INVALID_FIELD'
        });
      }
    }

    next();
  };
};

module.exports = {
  // SQL Injection
  detectSqlInjection,
  escapeSql,

  // XSS
  escapeHtml,
  removeHtmlTags,
  detectXss,

  // Command Injection
  detectCommandInjection,
  escapeCommand,

  // Path Traversal
  detectPathTraversal,
  normalizeFilePath,

  // Encoding/Decoding
  encodeHex,
  decodeHex,
  encodeBase64,
  decodeBase64,

  // Sanitization
  sanitizeString,
  sanitizeObject,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeEmail,

  // Middleware Factories
  createSanitizationMiddleware,
  createFieldValidator
};
