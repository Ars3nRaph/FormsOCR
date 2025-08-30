"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchController = exports.BatchController = void 0;
const batch_service_1 = require("../services/batch.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class BatchController {
    async createBatchJob(req, res, next) {
        try {
            const { projectId, name, processingOptions } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new errors_1.ApiError('User authentication required', 401);
            }
            const batchJob = await batch_service_1.batchService.createBatchJob({
                projectId,
                userId,
                name,
                processingOptions
            });
            res.status(201).json({
                success: true,
                data: batchJob
            });
        }
        catch (error) {
            logger_1.logger.error('Batch job creation error:', error);
            next(error);
        }
    }
    async getBatchStatus(req, res, next) {
        try {
            const { batchId } = req.params;
            const userId = req.user?.id;
            const status = await batch_service_1.batchService.getBatchStatus(batchId, userId);
            res.json({
                success: true,
                data: status
            });
        }
        catch (error) {
            logger_1.logger.error('Batch status retrieval error:', error);
            next(error);
        }
    }
    async getBatchResults(req, res, next) {
        try {
            const { batchId } = req.params;
            const userId = req.user?.id;
            const results = await batch_service_1.batchService.getBatchResults(batchId, userId);
            res.json({
                success: true,
                data: results
            });
        }
        catch (error) {
            logger_1.logger.error('Batch results retrieval error:', error);
            next(error);
        }
    }
    async cancelBatchJob(req, res, next) {
        try {
            const { batchId } = req.params;
            const userId = req.user?.id;
            const cancelled = await batch_service_1.batchService.cancelBatchJob(batchId, userId);
            res.json({
                success: true,
                data: { cancelled }
            });
        }
        catch (error) {
            logger_1.logger.error('Batch job cancellation error:', error);
            next(error);
        }
    }
    async getUserBatchJobs(req, res, next) {
        try {
            const { userId } = req.params;
            const requestUserId = req.user?.id;
            if (userId !== requestUserId) {
                throw new errors_1.ApiError('Access denied', 403);
            }
            const batchJobs = await batch_service_1.batchService.getUserBatchJobs(userId);
            res.json({
                success: true,
                data: batchJobs
            });
        }
        catch (error) {
            logger_1.logger.error('User batch jobs retrieval error:', error);
            next(error);
        }
    }
}
exports.BatchController = BatchController;
exports.batchController = new BatchController();
