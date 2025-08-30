"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const errorMiddleware = (error, req, res, next) => {
    logger_1.logger.error('Error middleware caught:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    if (error instanceof errors_1.ApiError) {
        res.status(error.statusCode).json({
            success: false,
            error: {
                message: error.message,
                code: error.code,
                status: error.statusCode,
                timestamp: new Date().toISOString()
            }
        });
        return;
    }
    if (error.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            error: {
                message: 'Validation failed',
                details: error.message,
                status: 400,
                timestamp: new Date().toISOString()
            }
        });
        return;
    }
    if (error.name === 'MulterError') {
        let message = 'File upload error';
        let status = 400;
        const code = error.code;
        switch (code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
        }
        res.status(status).json({
            success: false,
            error: {
                message,
                status,
                timestamp: new Date().toISOString()
            }
        });
        return;
    }
    if (error.message.includes('duplicate key value')) {
        res.status(409).json({
            success: false,
            error: {
                message: 'Resource already exists',
                status: 409,
                timestamp: new Date().toISOString()
            }
        });
        return;
    }
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
        success: false,
        error: {
            message: isDevelopment ? error.message : 'Internal server error',
            status: 500,
            timestamp: new Date().toISOString(),
            ...(isDevelopment && { stack: error.stack })
        }
    });
};
exports.errorMiddleware = errorMiddleware;
