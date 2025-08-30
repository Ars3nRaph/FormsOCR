"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const routes_1 = require("./routes");
const middleware_1 = require("./middleware");
const logger_1 = require("./utils/logger");
const services_1 = require("./services");
const redis_1 = require("./config/redis");
dotenv_1.default.config();
class Server {
    constructor() {
        this.app = (0, express_1.default)();
        this.port = parseInt(process.env.PORT || '8080', 10);
        this.setupApp();
    }
    async setupApp() {
        try {
            this.app.use((0, helmet_1.default)({
                crossOriginResourcePolicy: { policy: 'cross-origin' },
                contentSecurityPolicy: false
            }));
            const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
                'http://localhost:3000',
                'https://*.vercel.app',
                'https://formsocr.vercel.app'
            ];
            this.app.use((0, cors_1.default)({
                origin: (origin, callback) => {
                    if (!origin)
                        return callback(null, true);
                    const allowed = allowedOrigins.some(allowedOrigin => {
                        if (allowedOrigin.includes('*')) {
                            const pattern = allowedOrigin.replace(/\*/g, '.*');
                            return new RegExp(`^${pattern}$`).test(origin);
                        }
                        return allowedOrigin === origin;
                    });
                    return callback(null, allowed);
                },
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            }));
            this.app.use((0, compression_1.default)());
            this.app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
            this.app.use(express_1.default.json({ limit: '50mb' }));
            this.app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
            this.app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
            this.app.use('/results', express_1.default.static(path_1.default.join(__dirname, '../results')));
            await (0, middleware_1.setupMiddleware)(this.app);
            await (0, services_1.initializeServices)();
            (0, routes_1.setupRoutes)(this.app);
            this.app.get('/health', (req, res) => {
                res.status(200).json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    environment: process.env.NODE_ENV || 'development',
                    version: process.env.npm_package_version || '1.0.0'
                });
            });
            this.app.use((err, req, res, next) => {
                logger_1.logger.error('Unhandled error:', err);
                res.status(err.status || 500).json({
                    error: {
                        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
                        status: err.status || 500,
                        timestamp: new Date().toISOString()
                    }
                });
            });
            this.app.use('*', (req, res) => {
                res.status(404).json({
                    error: {
                        message: 'Route not found',
                        status: 404,
                        path: req.originalUrl
                    }
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to setup app:', error);
            process.exit(1);
        }
    }
    async start() {
        try {
            if (process.env.REDIS_URL) {
                await (0, redis_1.connectRedis)();
            }
            this.server = (0, http_1.createServer)(this.app);
            this.server.listen(this.port, '0.0.0.0', () => {
                logger_1.logger.info(`🚀 FormsOCR Backend Server running on port ${this.port}`);
                logger_1.logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
                logger_1.logger.info(`📊 Health check: http://localhost:${this.port}/health`);
                logger_1.logger.info(`🚅 Railway deployment ready`);
            });
            this.setupGracefulShutdown();
        }
        catch (error) {
            logger_1.logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            logger_1.logger.info(`${signal} received, shutting down gracefully`);
            this.server.close((err) => {
                if (err) {
                    logger_1.logger.error('Error during server shutdown:', err);
                    process.exit(1);
                }
                logger_1.logger.info('Server closed successfully');
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}
const server = new Server();
server.start().catch(error => {
    logger_1.logger.error('Failed to start application:', error);
    process.exit(1);
});
exports.default = Server;
