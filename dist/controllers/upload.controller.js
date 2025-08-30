"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = exports.UploadController = void 0;
const upload_service_1 = require("../services/upload.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const fileValidation_1 = require("../utils/fileValidation");
class UploadController {
    async uploadDocument(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_1.ApiError('No file uploaded', 400);
            }
            (0, fileValidation_1.validateFile)(req.file);
            const userId = req.user?.id;
            if (!userId) {
                throw new errors_1.ApiError('User authentication required', 401);
            }
            const uploadResult = await upload_service_1.uploadService.uploadDocument(req.file, userId);
            res.json({
                success: true,
                data: uploadResult
            });
        }
        catch (error) {
            logger_1.logger.error('Document upload error:', error);
            next(error);
        }
    }
    async uploadBatchDocuments(req, res, next) {
        try {
            const files = req.files;
            if (!files || files.length === 0) {
                throw new errors_1.ApiError('No files uploaded', 400);
            }
            const userId = req.user?.id;
            if (!userId) {
                throw new errors_1.ApiError('User authentication required', 401);
            }
            files.forEach(fileValidation_1.validateFile);
            const uploadResults = await upload_service_1.uploadService.uploadBatchDocuments(files, userId);
            res.json({
                success: true,
                data: uploadResults
            });
        }
        catch (error) {
            logger_1.logger.error('Batch documents upload error:', error);
            next(error);
        }
    }
    async uploadTemplate(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_1.ApiError('No template file uploaded', 400);
            }
            (0, fileValidation_1.validateFile)(req.file);
            const userId = req.user?.id;
            if (!userId) {
                throw new errors_1.ApiError('User authentication required', 401);
            }
            const uploadResult = await upload_service_1.uploadService.uploadTemplate(req.file, userId);
            res.json({
                success: true,
                data: uploadResult
            });
        }
        catch (error) {
            logger_1.logger.error('Template upload error:', error);
            next(error);
        }
    }
}
exports.UploadController = UploadController;
exports.uploadController = new UploadController();
