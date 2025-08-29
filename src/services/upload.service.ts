
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/errors';
import { sanitizeFileName } from '../utils/fileValidation';

interface UploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedAt: string;
}

interface FailedUploadResult {
  filename: string;
  error: string;
  success: false;
}

type BatchUploadResult = UploadResult | FailedUploadResult;

export class UploadService {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'temp'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create upload directories:', error);
    }
  }

  async uploadDocument(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    try {
      const fileId = uuidv4();
      const sanitizedName = sanitizeFileName(file.originalname);
      const fileName = `${fileId}_${sanitizedName}`;
      const filePath = path.join(this.uploadDir, 'documents', fileName);

      // Move file to permanent location
      await fs.copyFile(file.path, filePath);
      await fs.unlink(file.path); // Clean up temp file

      const fileInfo = await fs.stat(filePath);

      logger.info(`Document uploaded: ${fileName} by user ${userId}`);

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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Document upload failed:', error);
      throw new ApiError('Failed to upload document', 500);
    }
  }

  async uploadBatchDocuments(files: Express.Multer.File[], userId: string) {
    try {
      const uploadResults: BatchUploadResult[] = [];

      for (const file of files) {
        try {
          const result = await this.uploadDocument(file, userId);
          uploadResults.push(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          logger.error(`Failed to upload file ${file.originalname}:`, error);
          uploadResults.push({
            filename: file.originalname,
            error: errorMessage,
            success: false
          });
        }
      }

      const successful = uploadResults.filter(result => !('error' in result)).length;
      const failed = uploadResults.filter(result => 'error' in result).length;

      logger.info(`Batch upload completed for user ${userId}. Success: ${successful}, Failed: ${failed}`);

      return {
        totalFiles: files.length,
        successful,
        failed,
        results: uploadResults
      };

    } catch (error) {
      logger.error('Batch upload failed:', error);
      throw new ApiError('Failed to upload batch documents', 500);
    }
  }

  async uploadTemplate(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    try {
      const fileId = uuidv4();
      const sanitizedName = sanitizeFileName(file.originalname);
      const fileName = `${fileId}_${sanitizedName}`;
      const filePath = path.join(this.uploadDir, 'templates', fileName);

      // Move file to permanent location
      await fs.copyFile(file.path, filePath);
      await fs.unlink(file.path); // Clean up temp file

      const fileInfo = await fs.stat(filePath);

      logger.info(`Template uploaded: ${fileName} by user ${userId}`);

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

    } catch (error) {
      logger.error('Template upload failed:', error);
      throw new ApiError('Failed to upload template', 500);
    }
  }

  async cleanupOldFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const tempDir = path.join(this.uploadDir, 'temp');
      const files = await fs.readdir(tempDir);

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.unlink(filePath);
          logger.info(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('File cleanup failed:', error);
    }
  }
}

export const uploadService = new UploadService();