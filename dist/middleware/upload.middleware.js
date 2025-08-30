"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const errors_1 = require("../utils/errors");
const fileValidation_1 = require("../utils/fileValidation");
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'temp');
fs_1.promises.mkdir(uploadDir, { recursive: true }).catch(() => { });
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${(0, fileValidation_1.sanitizeFileName)(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
        'image/bmp'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new errors_1.ApiError(`Unsupported file type: ${file.mimetype}`, 400));
    }
};
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 100
    }
});
