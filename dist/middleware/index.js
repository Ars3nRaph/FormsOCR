"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = exports.loggingMiddleware = exports.errorMiddleware = exports.authMiddleware = exports.setupMiddleware = void 0;
const auth_middleware_1 = require("./auth.middleware");
Object.defineProperty(exports, "authMiddleware", { enumerable: true, get: function () { return auth_middleware_1.authMiddleware; } });
const error_middleware_1 = require("./error.middleware");
Object.defineProperty(exports, "errorMiddleware", { enumerable: true, get: function () { return error_middleware_1.errorMiddleware; } });
const logging_middleware_1 = require("./logging.middleware");
Object.defineProperty(exports, "loggingMiddleware", { enumerable: true, get: function () { return logging_middleware_1.loggingMiddleware; } });
const rateLimit_middleware_1 = require("./rateLimit.middleware");
Object.defineProperty(exports, "rateLimitMiddleware", { enumerable: true, get: function () { return rateLimit_middleware_1.rateLimitMiddleware; } });
const setupMiddleware = async (app) => {
    app.use(logging_middleware_1.loggingMiddleware);
    app.use((0, rateLimit_middleware_1.rateLimitMiddleware)('global'));
    app.use(error_middleware_1.errorMiddleware);
};
exports.setupMiddleware = setupMiddleware;
