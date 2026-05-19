/**
 * Request Validation Middleware
 * Standardized validation using custom validators
 */

const {
  ValidationError,
  MissingFieldError,
  InvalidFieldError,
  InvalidEnumError,
} = require("../utils/errors");

/**
 * Validate required fields
 * @param {array} requiredFields - Array of field names
 */
const validateRequiredFields = (requiredFields = []) => {
  return (req, res, next) => {
    const errors = {};

    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === "") {
        errors[field] = `${field} is required`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(new ValidationError("Missing required fields", errors));
    }

    next();
  };
};

/**
 * Validate field types
 * @param {object} schema - Schema defining field types and rules
 */
const validateSchema = (schema) => {
  return (req, res, next) => {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // Check if required
      if (rules.required && (value === undefined || value === null || value === "")) {
        errors[field] = `${field} is required`;
        continue;
      }

      // Skip validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Check type
      if (rules.type) {
        const expectedType = rules.type;
        const actualType = typeof value;
        const isArray = Array.isArray(value);

        if (expectedType === "array" && !isArray) {
          errors[field] = `${field} must be an array`;
          continue;
        }

        if (expectedType !== "array" && actualType !== expectedType) {
          errors[field] = `${field} must be of type ${expectedType}`;
          continue;
        }
      }

      // Check enum values
      if (rules.enum && !rules.enum.includes(value)) {
        errors[field] = `${field} must be one of: ${rules.enum.join(", ")}`;
        continue;
      }

      // Check minimum length
      if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
        errors[field] = `${field} must be at least ${rules.minLength} characters`;
        continue;
      }

      // Check maximum length
      if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
        errors[field] = `${field} must not exceed ${rules.maxLength} characters`;
        continue;
      }

      // Check minimum value
      if (rules.min !== undefined && typeof value === "number" && value < rules.min) {
        errors[field] = `${field} must be at least ${rules.min}`;
        continue;
      }

      // Check maximum value
      if (rules.max !== undefined && typeof value === "number" && value > rules.max) {
        errors[field] = `${field} must not exceed ${rules.max}`;
        continue;
      }

      // Check pattern (regex)
      if (rules.pattern && typeof value === "string" && !rules.pattern.test(value)) {
        errors[field] = rules.patternError || `${field} format is invalid`;
        continue;
      }

      // Custom validator function
      if (rules.custom && typeof rules.custom === "function") {
        const customError = rules.custom(value);
        if (customError) {
          errors[field] = customError;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(new ValidationError("Validation failed", errors));
    }

    next();
  };
};

/**
 * Validate enum values
 * @param {string} field - Field name
 * @param {array} allowedValues - Array of allowed values
 */
const validateEnum = (field, allowedValues = []) => {
  return (req, res, next) => {
    const value = req.body[field];

    if (value !== undefined && !allowedValues.includes(value)) {
      return next(new InvalidEnumError(field, allowedValues));
    }

    next();
  };
};

/**
 * Validate email format
 * @param {string} field - Field name (default: email)
 */
const validateEmail = (field = "email") => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (req, res, next) => {
    const value = req.body[field];

    if (value && !emailRegex.test(value)) {
      return next(new InvalidFieldError(field, "Invalid email format"));
    }

    next();
  };
};

/**
 * Validate password strength
 * @param {string} field - Field name (default: password)
 */
const validatePassword = (field = "password") => {
  return (req, res, next) => {
    const value = req.body[field];

    if (!value) {
      return next();
    }

    // Check minimum length
    if (value.length < 8) {
      return next(new InvalidFieldError(field, "Must be at least 8 characters"));
    }

    // Check for uppercase
    if (!/[A-Z]/.test(value)) {
      return next(new InvalidFieldError(field, "Must contain at least one uppercase letter"));
    }

    // Check for lowercase
    if (!/[a-z]/.test(value)) {
      return next(new InvalidFieldError(field, "Must contain at least one lowercase letter"));
    }

    // Check for number
    if (!/[0-9]/.test(value)) {
      return next(new InvalidFieldError(field, "Must contain at least one number"));
    }

    // Check for special character
    if (!/[!@#$%^&*]/.test(value)) {
      return next(new InvalidFieldError(field, "Must contain at least one special character (!@#$%^&*)"));
    }

    next();
  };
};

/**
 * Validate URL format
 * @param {string} field - Field name
 */
const validateUrl = (field) => {
  return (req, res, next) => {
    const value = req.body[field];

    if (!value) {
      return next();
    }

    try {
      new URL(value);
      next();
    } catch (err) {
      next(new InvalidFieldError(field, "Invalid URL format"));
    }
  };
};

/**
 * Sanitize input
 * Removes potentially dangerous characters
 */
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        // Remove HTML tags and trim
        req.body[key] = req.body[key].replace(/<[^>]*>/g, "").trim();
      }
    }
  }

  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (maxLimit = 100) => {
  return (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return next(new InvalidFieldError("page", "Must be a positive integer"));
    }

    if (isNaN(limitNum) || limitNum < 1) {
      return next(new InvalidFieldError("limit", "Must be a positive integer"));
    }

    if (limitNum > maxLimit) {
      return next(new InvalidFieldError("limit", `Cannot exceed ${maxLimit}`));
    }

    req.pagination = { page: pageNum, limit: limitNum };
    next();
  };
};

/**
 * Validate date format (ISO 8601)
 * @param {string} field - Field name
 */
const validateDate = (field) => {
  return (req, res, next) => {
    const value = req.body[field];

    if (!value) {
      return next();
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return next(new InvalidFieldError(field, "Invalid date format. Use ISO 8601 (YYYY-MM-DD)"));
    }

    next();
  };
};

/**
 * Validate numeric fields
 * @param {string} field - Field name
 * @param {object} options - min, max, allowNegative, decimal
 */
const validateNumber = (field, options = {}) => {
  return (req, res, next) => {
    const value = req.body[field];

    if (value === undefined || value === null || value === "") {
      return next();
    }

    const num = parseFloat(value);

    if (isNaN(num)) {
      return next(new InvalidFieldError(field, "Must be a valid number"));
    }

    if (options.min !== undefined && num < options.min) {
      return next(new InvalidFieldError(field, `Must be at least ${options.min}`));
    }

    if (options.max !== undefined && num > options.max) {
      return next(new InvalidFieldError(field, `Must not exceed ${options.max}`));
    }

    if (!options.allowNegative && num < 0) {
      return next(new InvalidFieldError(field, "Must not be negative"));
    }

    if (options.decimal === false && !Number.isInteger(num)) {
      return next(new InvalidFieldError(field, "Must be an integer"));
    }

    next();
  };
};

module.exports = {
  validateRequiredFields,
  validateSchema,
  validateEnum,
  validateEmail,
  validatePassword,
  validateUrl,
  sanitizeInput,
  validatePagination,
  validateDate,
  validateNumber,
};
