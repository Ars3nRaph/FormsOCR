
import { ApiError } from './errors';
import path from 'path';

export const validateFile = (file: Express.Multer.File) => {
  if (!file) {
    throw new ApiError('No file provided', 400);
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    throw new ApiError('File too large. Maximum size is 50MB', 400);
  }

  // Check file type
  const allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/tiff',
    'image/bmp'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new ApiError(
      `Unsupported file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`,
      400
    );
  }

  // Check file extension
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExt)) {
    throw new ApiError(
      `Unsupported file extension: ${fileExt}. Allowed extensions: ${allowedExtensions.join(', ')}`,
      400
    );
  }

  return true;
};

export const sanitizeFileName = (filename: string): string => {
  // Remove dangerous characters and limit length
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
};
