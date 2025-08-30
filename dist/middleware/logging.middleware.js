"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = void 0;
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const loggingMiddleware = (req, res, next) => {
    req.requestId = (0, uuid_1.v4)();
    const startTime = Date.now();
    logger_1.logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        timestamp: new Date().toISOString()
    });
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        const duration = Date.now() - startTime;
        logger_1.logger.info('Outgoing response', {
            requestId: req.requestId,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: JSON.stringify(body).length,
            timestamp: new Date().toISOString()
        });
        return originalJson(body);
    };
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (res.statusCode >= 400) {
            logger_1.logger.warn('Request completed with error', {
                requestId: req.requestId,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            });
        }
    });
    next();
};
exports.loggingMiddleware = loggingMiddleware;
