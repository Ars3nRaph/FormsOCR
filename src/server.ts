
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { setupRoutes } from './routes';
import { setupMiddleware } from './middleware';
import { logger } from './utils/logger';
import { initializeServices } from './services';
import { connectRedis } from './config/redis';

// Load environment variables
dotenv.config();

class Server {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001', 10);
    this.setupApp();
  }

  private async setupApp(): Promise<void> {
    try {
      // Security middleware
      this.app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' }
      }));

      // CORS configuration
      this.app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }));

      // Compression and logging
      this.app.use(compression());
      this.app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));

      // Body parsing
      this.app.use(express.json({ limit: '50mb' }));
      this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

      // Static file serving
      this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
      this.app.use('/results', express.static(path.join(__dirname, '../results')));

      // Custom middleware
      await setupMiddleware(this.app);

      // Initialize services
      await initializeServices();

      // Routes
      setupRoutes(this.app);

      // Health check endpoint
      this.app.get('/health', (req, res) => {
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0'
        });
      });

      // Error handling
      this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Unhandled error:', err);
        
        res.status(err.status || 500).json({
          error: {
            message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
            status: err.status || 500,
            timestamp: new Date().toISOString()
          }
        });
      });

      // 404 handler
      this.app.use('*', (req, res) => {
        res.status(404).json({
          error: {
            message: 'Route not found',
            status: 404,
            path: req.originalUrl
          }
        });
      });

    } catch (error) {
      logger.error('Failed to setup app:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // Connect to Redis if configured
      if (process.env.REDIS_URL) {
        await connectRedis();
      }

      // Start HTTP server
      this.server = createServer(this.app);
      
      this.server.listen(this.port, '0.0.0.0', () => {
        logger.info(`🚀 FormsOCR Backend Server running on port ${this.port}`);
        logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📊 Health check: http://localhost:${this.port}/health`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      this.server.close((err: any) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
          process.exit(1);
        }
        
        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start server
const server = new Server();
server.start().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default Server;
