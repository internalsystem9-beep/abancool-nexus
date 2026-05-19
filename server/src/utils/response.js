/**
 * API Response Formatter
 * Standardizes all API response formats across the application
 */

/**
 * Success Response Format
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {object} pagination - Optional pagination info
 * @param {object} meta - Optional metadata
 */
const successResponse = (data, message = "Success", statusCode = 200, pagination = null, meta = null) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (pagination) {
    response.pagination = pagination;
  }

  if (meta) {
    response.meta = meta;
  }

  response.timestamp = new Date().toISOString();

  return {
    statusCode,
    body: response,
  };
};

/**
 * Error Response Format
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} errorCode - Error code for client handling
 * @param {object} details - Additional error details
 * @param {object} validationErrors - Field-level validation errors
 */
const errorResponse = (error, statusCode = 500, errorCode = "ERROR", details = null, validationErrors = null) => {
  const response = {
    success: false,
    error,
    errorCode,
  };

  if (details) {
    response.details = details;
  }

  if (validationErrors) {
    response.validationErrors = validationErrors;
  }

  response.timestamp = new Date().toISOString();

  return {
    statusCode,
    body: response,
  };
};

/**
 * Paginated Response Format
 * @param {array} data - Array of items
 * @param {number} total - Total count of items
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 */
const paginatedResponse = (data, total, page = 1, limit = 20) => {
  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages,
      hasNextPage: page < pages,
      hasPreviousPage: page > 1,
    },
  };
};

/**
 * Format response for controller
 * Ensures all controller responses follow standard format
 */
const formatResponse = (res, data, message = "Success", statusCode = 200, pagination = null, meta = null) => {
  const response = successResponse(data, message, statusCode, pagination, meta);
  return res.status(response.statusCode).json(response.body);
};

/**
 * Format error response for controller
 */
const formatErrorResponse = (res, error, statusCode = 500, errorCode = "ERROR", details = null, validationErrors = null) => {
  const response = errorResponse(error, statusCode, errorCode, details, validationErrors);
  return res.status(response.statusCode).json(response.body);
};

/**
 * Validation error response with field-specific errors
 */
const validationErrorResponse = (errors) => {
  const validationErrors = {};

  if (Array.isArray(errors)) {
    // Express-validator format
    errors.forEach((err) => {
      validationErrors[err.param] = {
        message: err.msg,
        value: err.value,
        location: err.location,
      };
    });
  } else if (typeof errors === "object") {
    // Custom format
    Object.assign(validationErrors, errors);
  }

  return {
    success: false,
    error: "Validation failed",
    errorCode: "VALIDATION_ERROR",
    validationErrors,
    timestamp: new Date().toISOString(),
  };
};

/**
 * API Response Wrapper Class
 */
class ApiResponse {
  constructor(statusCode = 200, data = null, message = "Success", errorCode = null) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.data = data;
    this.message = message;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = "Success", statusCode = 200, pagination = null, meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (pagination) {
      response.pagination = pagination;
    }

    if (meta) {
      response.meta = meta;
    }

    return { statusCode, body: response };
  }

  static error(error, statusCode = 500, errorCode = "ERROR", details = null) {
    return {
      statusCode,
      body: {
        success: false,
        error,
        errorCode,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      },
    };
  }

  static paginated(data, total, page = 1, limit = 20) {
    const pages = Math.ceil(total / limit);
    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1,
      },
    };
  }

  toJSON() {
    const obj = {
      success: this.success,
      timestamp: this.timestamp,
    };

    if (this.message) {
      obj.message = this.message;
    }

    if (this.data !== null && this.data !== undefined) {
      obj.data = this.data;
    }

    if (!this.success && this.errorCode) {
      obj.errorCode = this.errorCode;
    }

    return obj;
  }
}

/**
 * Response metadata builder
 */
class ResponseMeta {
  constructor() {
    this.version = process.env.API_VERSION || "1.0.0";
    this.environment = process.env.NODE_ENV || "development";
    this.requestId = null;
  }

  withRequestId(requestId) {
    this.requestId = requestId;
    return this;
  }

  toJSON() {
    return {
      version: this.version,
      environment: this.environment,
      ...(this.requestId && { requestId: this.requestId }),
    };
  }
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  formatResponse,
  formatErrorResponse,
  validationErrorResponse,
  ApiResponse,
  ResponseMeta,
};
