
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { ApiError } from '../utils/errors';
import { sanitizeFileName } from '../utils/fileValidation';

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'temp');
fs.mkdir(uploadDir, { recursive: true }).catch(() => {});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${sanitizeFileName(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
  } else {
    cb(new ApiError(`Unsupported file type: ${file.mimetype}`, 400));
  }
};

// Configure multer
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 100 // Max 100 files for batch upload
  }
});
