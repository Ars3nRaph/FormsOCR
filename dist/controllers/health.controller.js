"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = exports.HealthController = void 0;
const ocr_service_1 = require("../services/ocr.service");
const logger_1 = require("../utils/logger");
class HealthController {
    async healthCheck(req, res) {
        res.status(200).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        });
    }
    async systemStatus(req, res) {
        try {
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            const status = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            };
            res.json({
                success: true,
                data: status
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('System status error:', error);
            res.status(500).json({
                success: false,
                status: 'unhealthy',
                error: errorMessage
            });
        }
    }
    async ocrStatus(req, res) {
        try {
            const ocrStatus = await ocr_service_1.ocrService.getServiceStatus();
            res.json({
                success: true,
                data: ocrStatus
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('OCR status error:', error);
            res.status(500).json({
                success: false,
                error: errorMessage
            });
        }
    }
}
exports.HealthController = HealthController;
exports.healthController = new HealthController();
