/**
 * Custom Error Classes for API Response Standardization
 * Provides structured error handling with specific error types
 */

// Base API Error Class
class ApiError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// 400 Bad Request Errors
class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

class MissingFieldError extends ApiError {
  constructor(field) {
    super(`Missing required field: ${field}`, 400, "MISSING_FIELD", { field });
  }
}

class InvalidFieldError extends ApiError {
  constructor(field, reason) {
    super(`Invalid field ${field}: ${reason}`, 400, "INVALID_FIELD", { field, reason });
  }
}

class InvalidEnumError extends ApiError {
  constructor(field, allowedValues) {
    super(
      `Invalid value for ${field}. Allowed values: ${allowedValues.join(", ")}`,
      400,
      "INVALID_ENUM",
      { field, allowedValues }
    );
  }
}

class DuplicateError extends ApiError {
  constructor(field, value) {
    super(`${field} already exists: ${value}`, 400, "DUPLICATE_ERROR", { field, value });
  }
}

// 401 Unauthorized Errors
class AuthenticationError extends ApiError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

class InvalidTokenError extends ApiError {
  constructor(reason = "Token is invalid or expired") {
    super(reason, 401, "INVALID_TOKEN", { reason });
  }
}

class TokenExpiredError extends ApiError {
  constructor() {
    super("Authentication token has expired", 401, "TOKEN_EXPIRED");
  }
}

class InvalidCredentialsError extends ApiError {
  constructor() {
    super("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
}

class MissingAuthHeaderError extends ApiError {
  constructor() {
    super("Authorization header is missing", 401, "MISSING_AUTH_HEADER");
  }
}

// 403 Forbidden Errors
class AuthorizationError extends ApiError {
  constructor(message = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

class PermissionDeniedError extends ApiError {
  constructor(permission) {
    super(`Permission denied: ${permission}`, 403, "PERMISSION_DENIED", { permission });
  }
}

class InsufficientPermissionsError extends ApiError {
  constructor(requiredPermissions) {
    super(
      `Insufficient permissions. Required: ${Array.isArray(requiredPermissions) ? requiredPermissions.join(", ") : requiredPermissions}`,
      403,
      "INSUFFICIENT_PERMISSIONS",
      { requiredPermissions: Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions] }
    );
  }
}

class RoleDeniedError extends ApiError {
  constructor(role) {
    super(`Access denied for role: ${role}`, 403, "ROLE_DENIED", { role });
  }
}

class AccountDisabledError extends ApiError {
  constructor() {
    super("Your account has been disabled", 403, "ACCOUNT_DISABLED");
  }
}

// 404 Not Found Errors
class NotFoundError extends ApiError {
  constructor(resource, identifier) {
    super(`${resource} not found: ${identifier}`, 404, "NOT_FOUND", { resource, identifier });
  }
}

class ResourceNotFoundError extends ApiError {
  constructor(resourceType, resourceId) {
    super(`${resourceType} with ID ${resourceId} not found`, 404, "RESOURCE_NOT_FOUND", {
      resourceType,
      resourceId,
    });
  }
}

class EntityNotFoundError extends ApiError {
  constructor(entityType) {
    super(`${entityType} not found`, 404, "ENTITY_NOT_FOUND", { entityType });
  }
}

// 409 Conflict Errors
class ConflictError extends ApiError {
  constructor(message, details = null) {
    super(message, 409, "CONFLICT_ERROR", details);
  }
}

class StateConflictError extends ApiError {
  constructor(message, currentState) {
    super(message, 409, "STATE_CONFLICT", { currentState });
  }
}

class ResourceAlreadyExistsError extends ApiError {
  constructor(resourceType, identifier) {
    super(
      `${resourceType} already exists: ${identifier}`,
      409,
      "RESOURCE_ALREADY_EXISTS",
      { resourceType, identifier }
    );
  }
}

// 422 Unprocessable Entity Errors
class UnprocessableEntityError extends ApiError {
  constructor(message, reason) {
    super(message, 422, "UNPROCESSABLE_ENTITY", { reason });
  }
}

class BusinessLogicError extends ApiError {
  constructor(message, reason = null) {
    super(message, 422, "BUSINESS_LOGIC_ERROR", { reason });
  }
}

class InvalidTransitionError extends ApiError {
  constructor(currentState, targetState) {
    super(
      `Cannot transition from ${currentState} to ${targetState}`,
      422,
      "INVALID_TRANSITION",
      { currentState, targetState }
    );
  }
}

class InsufficientFundsError extends ApiError {
  constructor(required, available) {
    super(
      `Insufficient funds. Required: ${required}, Available: ${available}`,
      422,
      "INSUFFICIENT_FUNDS",
      { required, available }
    );
  }
}

class RateLimitError extends ApiError {
  constructor(retryAfter = 60) {
    super(
      `Too many requests. Please try again after ${retryAfter} seconds`,
      429,
      "RATE_LIMIT_EXCEEDED",
      { retryAfter }
    );
  }
}

// 500 Server Errors
class InternalServerError extends ApiError {
  constructor(message = "Internal server error", details = null) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

class DatabaseError extends ApiError {
  constructor(message = "Database operation failed", details = null) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}

class ExternalServiceError extends ApiError {
  constructor(service, message) {
    super(`External service error: ${service} - ${message}`, 500, "EXTERNAL_SERVICE_ERROR", {
      service,
      message,
    });
  }
}

class ConfigurationError extends ApiError {
  constructor(message, key) {
    super(`Configuration error: ${message}`, 500, "CONFIGURATION_ERROR", { key });
  }
}

class OperationFailedError extends ApiError {
  constructor(operation, reason) {
    super(`${operation} failed: ${reason}`, 500, "OPERATION_FAILED", { operation, reason });
  }
}

// Utility function to check if error is an API error
const isApiError = (error) => error instanceof ApiError;

// Utility function to convert any error to API error
const toApiError = (error) => {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ValidationError("Invalid JSON in request body");
  }

  if (error.message && error.message.includes("jwt")) {
    return new InvalidTokenError(error.message);
  }

  if (error.code === "ER_DUP_ENTRY") {
    return new DuplicateError("Resource", error.sqlMessage);
  }

  if (error.code === "ER_NO_REFERENCED_ROW") {
    return new InvalidFieldError("Field", "Referenced record not found");
  }

  return new InternalServerError("An unexpected error occurred", {
    originalError: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

module.exports = {
  // Base class
  ApiError,

  // 400 errors
  ValidationError,
  MissingFieldError,
  InvalidFieldError,
  InvalidEnumError,
  DuplicateError,

  // 401 errors
  AuthenticationError,
  InvalidTokenError,
  TokenExpiredError,
  InvalidCredentialsError,
  MissingAuthHeaderError,

  // 403 errors
  AuthorizationError,
  PermissionDeniedError,
  InsufficientPermissionsError,
  RoleDeniedError,
  AccountDisabledError,

  // 404 errors
  NotFoundError,
  ResourceNotFoundError,
  EntityNotFoundError,

  // 409 errors
  ConflictError,
  StateConflictError,
  ResourceAlreadyExistsError,

  // 422 errors
  UnprocessableEntityError,
  BusinessLogicError,
  InvalidTransitionError,
  InsufficientFundsError,
  RateLimitError,

  // 500 errors
  InternalServerError,
  DatabaseError,
  ExternalServiceError,
  ConfigurationError,
  OperationFailedError,

  // Utilities
  isApiError,
  toApiError,
};
