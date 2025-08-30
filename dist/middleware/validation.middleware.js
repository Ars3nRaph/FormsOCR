"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBatchJob = exports.validateRegionExtraction = exports.validateOCRRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const errors_1 = require("../utils/errors");
const ocrRequestSchema = joi_1.default.object({
    rois: joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.array().items(joi_1.default.object({
        id: joi_1.default.string().required(),
        name: joi_1.default.string().required(),
        type: joi_1.default.string().valid('text', 'number', 'date', 'currency', 'email').required(),
        coordinates: joi_1.default.object({
            x: joi_1.default.number().min(0).required(),
            y: joi_1.default.number().min(0).required(),
            width: joi_1.default.number().min(1).required(),
            height: joi_1.default.number().min(1).required()
        }).required(),
        regex_pattern: joi_1.default.string().optional(),
        confidence_threshold: joi_1.default.number().min(0).max(1).optional()
    }))).default([]),
    engine: joi_1.default.string().valid('tesseract', 'rapidocr').default('tesseract'),
    confidence_threshold: joi_1.default.number().min(0).max(1).default(0.7),
    languages: joi_1.default.string().default('eng+fra')
});
const regionExtractionSchema = joi_1.default.object({
    regions: joi_1.default.alternatives().try(joi_1.default.string(), joi_1.default.array().items(joi_1.default.object({
        x: joi_1.default.number().min(0).required(),
        y: joi_1.default.number().min(0).required(),
        width: joi_1.default.number().min(1).required(),
        height: joi_1.default.number().min(1).required(),
        name: joi_1.default.string().optional()
    }))).required(),
    engine: joi_1.default.string().valid('tesseract', 'rapidocr').default('tesseract'),
    page: joi_1.default.number().min(1).default(1),
    scale: joi_1.default.number().min(0.1).max(10).default(1.0)
});
const batchJobSchema = joi_1.default.object({
    projectId: joi_1.default.string().uuid().required(),
    name: joi_1.default.string().min(1).max(255).required(),
    processingOptions: joi_1.default.object({
        engine: joi_1.default.string().valid('tesseract', 'rapidocr').default('tesseract'),
        outputFormat: joi_1.default.string().valid('csv', 'json').default('csv'),
        confidenceThreshold: joi_1.default.number().min(0).max(1).default(0.7),
        languages: joi_1.default.string().default('eng+fra')
    }).default({})
});
const validateOCRRequest = (req, res, next) => {
    const { error, value } = ocrRequestSchema.validate(req.body);
    if (error) {
        return next(new errors_1.ApiError(`Validation error: ${error.details[0].message}`, 400));
    }
    req.body = value;
    next();
};
exports.validateOCRRequest = validateOCRRequest;
const validateRegionExtraction = (req, res, next) => {
    const { error, value } = regionExtractionSchema.validate(req.body);
    if (error) {
        return next(new errors_1.ApiError(`Validation error: ${error.details[0].message}`, 400));
    }
    req.body = value;
    next();
};
exports.validateRegionExtraction = validateRegionExtraction;
const validateBatchJob = (req, res, next) => {
    const { error, value } = batchJobSchema.validate(req.body);
    if (error) {
        return next(new errors_1.ApiError(`Validation error: ${error.details[0].message}`, 400));
    }
    req.body = value;
    next();
};
exports.validateBatchJob = validateBatchJob;
