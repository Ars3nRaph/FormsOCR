"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ApiError = void 0;
class ApiError extends Error {
    constructor(message, statusCode = 500, code) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(message, field) {
        super(message, 400, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends ApiError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ApiError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND_ERROR');
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ApiError {
    constructor(message = 'Resource conflict') {
        super(message, 409, 'CONFLICT_ERROR');
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends ApiError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
