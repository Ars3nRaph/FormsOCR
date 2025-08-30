
import { Application } from 'express';
import ocrRoutes from './ocr.routes';
import batchRoutes from './batch.routes';
import healthRoutes from './health.routes';
import uploadRoutes from './upload.routes';

export const setupRoutes = (app: Application): void => {
  // API prefix
  const apiPrefix = '/api/v1';

  // Mount routes
  app.use(`${apiPrefix}/ocr`, ocrRoutes);
  app.use(`${apiPrefix}/batch`, batchRoutes);
  app.use(`${apiPrefix}/upload`, uploadRoutes);
  app.use(`${apiPrefix}/health`, healthRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'FormsOCR Backend API',
      version: '1.0.0',
      endpoints: {
        health: `${apiPrefix}/health`,
        ocr: `${apiPrefix}/ocr`,
        batch: `${apiPrefix}/batch`,
        upload: `${apiPrefix}/upload`
      }
    });
  });
};
