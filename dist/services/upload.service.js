"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = exports.UploadService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const fileValidation_1 = require("../utils/fileValidation");
class UploadService {
    constructor() {
        this.uploadDir = path_1.default.join(process.cwd(), 'uploads');
        this.ensureUploadDirectory();
    }
    async ensureUploadDirectory() {
        try {
            await fs_1.promises.mkdir(this.uploadDir, { recursive: true });
            await fs_1.promises.mkdir(path_1.default.join(this.uploadDir, 'documents'), { recursive: true });
            await fs_1.promises.mkdir(path_1.default.join(this.uploadDir, 'templates'), { recursive: true });
            await fs_1.promises.mkdir(path_1.default.join(this.uploadDir, 'temp'), { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Failed to create upload directories:', error);
        }
    }
    async uploadDocument(file, userId) {
        try {
            const fileId = (0, uuid_1.v4)();
            const sanitizedName = (0, fileValidation_1.sanitizeFileName)(file.originalname);
            const fileName = `${fileId}_${sanitizedName}`;
            const filePath = path_1.default.join(this.uploadDir, 'documents', fileName);
            await fs_1.promises.copyFile(file.path, filePath);
            await fs_1.promises.unlink(file.path);
            const fileInfo = await fs_1.promises.stat(filePath);
            logger_1.logger.info(`Document uploaded: ${fileName} by user ${userId}`);
            return {
                id: fileId,
                filename: sanitizedName,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: fileInfo.size,
                path: filePath,
                url: `/uploads/documents/${fileName}`,
                uploadedAt: new Date().toISOString()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            logger_1.logger.error('Document upload failed:', error);
            throw new errors_1.ApiError('Failed to upload document', 500);
        }
    }
    async uploadBatchDocuments(files, userId) {
        try {
            const uploadResults = [];
            for (const file of files) {
                try {
                    const result = await this.uploadDocument(file, userId);
                    uploadResults.push(result);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    logger_1.logger.error(`Failed to upload file ${file.originalname}:`, error);
                    uploadResults.push({
                        filename: file.originalname,
                        error: errorMessage,
                        success: false
                    });
                }
            }
            const successful = uploadResults.filter(result => !('error' in result)).length;
            const failed = uploadResults.filter(result => 'error' in result).length;
            logger_1.logger.info(`Batch upload completed for user ${userId}. Success: ${successful}, Failed: ${failed}`);
            return {
                totalFiles: files.length,
                successful,
                failed,
                results: uploadResults
            };
        }
        catch (error) {
            logger_1.logger.error('Batch upload failed:', error);
            throw new errors_1.ApiError('Failed to upload batch documents', 500);
        }
    }
    async uploadTemplate(file, userId) {
        try {
            const fileId = (0, uuid_1.v4)();
            const sanitizedName = (0, fileValidation_1.sanitizeFileName)(file.originalname);
            const fileName = `${fileId}_${sanitizedName}`;
            const filePath = path_1.default.join(this.uploadDir, 'templates', fileName);
            await fs_1.promises.copyFile(file.path, filePath);
            await fs_1.promises.unlink(file.path);
            const fileInfo = await fs_1.promises.stat(filePath);
            logger_1.logger.info(`Template uploaded: ${fileName} by user ${userId}`);
            return {
                id: fileId,
                filename: sanitizedName,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: fileInfo.size,
                path: filePath,
                url: `/uploads/templates/${fileName}`,
                uploadedAt: new Date().toISOString()
            };
        }
        catch (error) {
            logger_1.logger.error('Template upload failed:', error);
            throw new errors_1.ApiError('Failed to upload template', 500);
        }
    }
    async cleanupOldFiles(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const tempDir = path_1.default.join(this.uploadDir, 'temp');
            const files = await fs_1.promises.readdir(tempDir);
            for (const file of files) {
                const filePath = path_1.default.join(tempDir, file);
                const stats = await fs_1.promises.stat(filePath);
                const age = Date.now() - stats.mtime.getTime();
                if (age > maxAge) {
                    await fs_1.promises.unlink(filePath);
                    logger_1.logger.info(`Cleaned up old temp file: ${file}`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('File cleanup failed:', error);
        }
    }
}
exports.UploadService = UploadService;
exports.uploadService = new UploadService();
