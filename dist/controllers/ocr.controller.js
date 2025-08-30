"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrController = exports.OCRController = void 0;
const ocr_service_1 = require("../services/ocr.service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const fileValidation_1 = require("../utils/fileValidation");
class OCRController {
    async processDocument(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_1.ApiError('No file uploaded', 400);
            }
            (0, fileValidation_1.validateFile)(req.file);
            const { rois = [], engine = 'tesseract', confidence_threshold = 0.7, languages = 'eng+fra' } = req.body;
            const parsedRois = typeof rois === 'string' ? JSON.parse(rois) : rois;
            logger_1.logger.info(`Processing document: ${req.file.filename} with ${parsedRois.length} ROIs`);
            const result = await ocr_service_1.ocrService.processDocument(req.file.path, {
                rois: parsedRois,
                engine,
                confidenceThreshold: confidence_threshold,
                languages
            });
            res.json({
                success: true,
                data: {
                    filename: req.file.filename,
                    extractedData: result.extractedData,
                    confidenceScores: result.confidenceScores,
                    processingTime: result.processingTime,
                    engine: result.engine,
                    metadata: {
                        pageCount: result.pageCount,
                        imageSize: result.imageSize,
                        language: result.detectedLanguage
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('OCR processing error:', error);
            next(error);
        }
    }
    async extractRegions(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_1.ApiError('No file uploaded', 400);
            }
            (0, fileValidation_1.validateFile)(req.file);
            const { regions = [], engine = 'tesseract', page = 1, scale = 1.0 } = req.body;
            const parsedRegions = typeof regions === 'string' ? JSON.parse(regions) : regions;
            const result = await ocr_service_1.ocrService.extractRegions(req.file.path, {
                regions: parsedRegions,
                engine,
                page,
                scale
            });
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            logger_1.logger.error('Region extraction error:', error);
            next(error);
        }
    }
    async previewDocument(req, res, next) {
        try {
            if (!req.file) {
                throw new errors_1.ApiError('No file uploaded', 400);
            }
            (0, fileValidation_1.validateFile)(req.file);
            const { page = 1, width = 800, height = 600 } = req.body;
            const result = await ocr_service_1.ocrService.previewDocument(req.file.path, {
                page,
                width,
                height
            });
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            logger_1.logger.error('Preview generation error:', error);
            next(error);
        }
    }
    async getEngines(req, res) {
        const engines = await ocr_service_1.ocrService.getAvailableEngines();
        res.json({
            success: true,
            data: {
                engines,
                default: 'tesseract'
            }
        });
    }
    async getStatus(req, res) {
        const status = await ocr_service_1.ocrService.getServiceStatus();
        res.json({
            success: true,
            data: status
        });
    }
}
exports.OCRController = OCRController;
exports.ocrController = new OCRController();
