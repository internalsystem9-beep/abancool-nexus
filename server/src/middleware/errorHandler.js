/**
 * Global Error Handler Middleware
 * Catches and formats all errors to standard API response format
 */

const { isApiError, toApiError } = require("../utils/errors");
const { errorResponse } = require("../utils/response");

/**
 * Error Handler Middleware
 * Must be registered last in Express app
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = 500;
  let message = "Internal server error";
  let errorCode = "INTERNAL_SERVER_ERROR";
  let details = null;

  // Log error for monitoring
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", {
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
    });
  }

  // Handle API errors
  if (isApiError(err)) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode;
    details = err.details;
  } else {
    // Convert non-API errors to API errors
    const apiError = toApiError(err);
    statusCode = apiError.statusCode;
    message = apiError.message;
    errorCode = apiError.errorCode;
    details = apiError.details;
  }

  // Security: Don't expose sensitive information in production
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    message = "An internal error occurred";
    details = null;
  }

  // Log to audit trail if applicable
  if (req.user && req.user.id) {
    // Optional: log errors to audit_logs table
    try {
      const db = require("../config/db");
      db.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, changes, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.user.id,
          "error_occurred",
          "api_error",
          JSON.stringify({
            errorCode,
            message,
            endpoint: req.originalUrl,
            method: req.method,
          }),
        ]
      ).catch((dbErr) => {
        // Silently fail audit log - don't let it propagate
        console.error("Failed to log error to audit trail:", dbErr);
      });
    } catch (e) {
      // Silently fail
    }
  }

  // Format and send response
  const response = errorResponse(message, statusCode, errorCode, details);

  res.status(response.statusCode).json(response.body);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors and pass to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Handler Middleware
 * Must be registered after all route handlers
 */
const notFoundHandler = (req, res, next) => {
  const { NotFoundError } = require("../utils/errors");
  next(new NotFoundError("Endpoint", req.originalUrl));
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
};
