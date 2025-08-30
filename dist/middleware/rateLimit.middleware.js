"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const errors_1 = require("../utils/errors");
const limiters = {
    global: new rate_limiter_flexible_1.RateLimiterMemory({
        points: 100,
        duration: 60,
        blockDuration: 60,
    }),
    ocr: new rate_limiter_flexible_1.RateLimiterMemory({
        points: 10,
        duration: 60,
        blockDuration: 120,
    }),
    batch: new rate_limiter_flexible_1.RateLimiterMemory({
        points: 5,
        duration: 300,
        blockDuration: 600,
    }),
    upload: new rate_limiter_flexible_1.RateLimiterMemory({
        points: 20,
        duration: 60,
        blockDuration: 180,
    }),
    preview: new rate_limiter_flexible_1.RateLimiterMemory({
        points: 30,
        duration: 60,
        blockDuration: 60,
    })
};
const rateLimitMiddleware = (limiterType = 'global') => {
    return async (req, res, next) => {
        try {
            const limiter = limiters[limiterType];
            const key = req.ip || 'anonymous';
            await limiter.consume(key);
            next();
        }
        catch (rejRes) {
            const secs = Math.round((rejRes?.msBeforeNext || 1000) / 1000) || 1;
            res.set('Retry-After', String(secs));
            return next(new errors_1.ApiError(`Rate limit exceeded. Try again in ${secs} seconds.`, 429));
        }
    };
};
exports.rateLimitMiddleware = rateLimitMiddleware;
