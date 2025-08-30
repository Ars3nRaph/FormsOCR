"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = exports.batchService = exports.ocrService = exports.initializeServices = void 0;
const ocr_service_1 = require("./ocr.service");
Object.defineProperty(exports, "ocrService", { enumerable: true, get: function () { return ocr_service_1.ocrService; } });
const batch_service_1 = require("./batch.service");
Object.defineProperty(exports, "batchService", { enumerable: true, get: function () { return batch_service_1.batchService; } });
const upload_service_1 = require("./upload.service");
Object.defineProperty(exports, "uploadService", { enumerable: true, get: function () { return upload_service_1.uploadService; } });
const logger_1 = require("../utils/logger");
const initializeServices = async () => {
    try {
        logger_1.logger.info('Initializing services...');
        logger_1.logger.info('OCR service initialized');
        setInterval(() => {
            upload_service_1.uploadService.cleanupOldFiles().catch(error => {
                logger_1.logger.error('File cleanup error:', error);
            });
        }, 60 * 60 * 1000);
        logger_1.logger.info('All services initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Service initialization failed:', error);
        throw error;
    }
};
exports.initializeServices = initializeServices;
