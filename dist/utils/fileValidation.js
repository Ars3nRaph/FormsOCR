"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeFileName = exports.validateFile = void 0;
const errors_1 = require("./errors");
const path_1 = __importDefault(require("path"));
const validateFile = (file) => {
    if (!file) {
        throw new errors_1.ApiError('No file provided', 400);
    }
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new errors_1.ApiError('File too large. Maximum size is 50MB', 400);
    }
    const allowedMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
        'image/bmp'
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new errors_1.ApiError(`Unsupported file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`, 400);
    }
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];
    const fileExt = path_1.default.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
        throw new errors_1.ApiError(`Unsupported file extension: ${fileExt}. Allowed extensions: ${allowedExtensions.join(', ')}`, 400);
    }
    return true;
};
exports.validateFile = validateFile;
const sanitizeFileName = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 255);
};
exports.sanitizeFileName = sanitizeFileName;
