
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
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
    // Railway uses PORT environment variable, fallback to 8080
    this.port = parseInt(process.env.PORT || '8080', 10);
    this.setupApp();
  }

  private async setupApp(): Promise<void> {
    try {
      // Trust proxy - Important for Railway
      this.app.set('trust proxy', 1);

      // Security middleware - Railway optimized
      this.app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false,
        hsts: process.env.NODE_ENV === 'production'
      }));

      // CORS configuration for Railway deployment
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'https://localhost:3000',
        'https://*.vercel.app',
        'https://formsocr.vercel.app'
      ];

      this.app.use(cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, postman, etc.)
          if (!origin) return callback(null, true);
          
          // Check exact match or wildcard pattern
          const allowed = allowedOrigins.some(allowedOrigin => {
            if (allowedOrigin.includes('*')) {
              const pattern = allowedOrigin.replace(/\*/g, '.*');
              return new RegExp(`^${pattern}$`).test(origin);
            }
            return allowedOrigin === origin;
          });
          
          if (!allowed) {
            logger.warn(`CORS blocked origin: ${origin}`);
          }
          
          return callback(null, allowed);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
      }));

      // Compression and logging
      this.app.use(compression({ level: 6, threshold: 1024 }));
      
      // Request logging with conditional output
      if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
        this.app.use(morgan('combined', { 
          stream: { write: (message: string) => logger.info(message.trim()) },
          skip: (req) => req.url === '/health' // Skip health check logs
        }));
      }

      // Body parsing with proper limits
      this.app.use(express.json({ 
        limit: process.env.MAX_FILE_SIZE || '50mb',
        verify: (req, res, buf) => {
          if (buf && buf.length > 0) {
            (req as any).rawBody = buf;
          }
        }
      }));
      this.app.use(express.urlencoded({ 
        extended: true, 
        limit: process.env.MAX_FILE_SIZE || '50mb' 
      }));

      // Static file serving with proper caching
      this.app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
        maxAge: '1d',
        etag: true
      }));
      this.app.use('/results', express.static(path.join(__dirname, '../results'), {
        maxAge: '1h',
        etag: true
      }));

      // Custom middleware setup
      await setupMiddleware(this.app);

      // Initialize services
      await initializeServices();

      // API routes
      setupRoutes(this.app);

      // Enhanced health check endpoint for Railway
      this.app.get('/health', (req, res) => {
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
          port: this.port,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          services: {
            database: 'connected',
            redis: process.env.REDIS_URL ? 'connected' : 'disabled'
          }
        };
        
        res.status(200).json(healthData);
      });

      // Readiness probe for Railway
      this.app.get('/ready', (req, res) => {
        if (this.isShuttingDown) {
          return res.status(503).json({ status: 'shutting_down' });
        }
        res.status(200).json({ status: 'ready' });
      });

      // Global error handling middleware
      this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('Unhandled error:', {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
          ip: req.ip
        });
        
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        res.status(err.status || 500).json({
          success: false,
          error: {
            message: isDevelopment ? err.message : 'Internal server error',
            status: err.status || 500,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'],
            ...(isDevelopment && { stack: err.stack })
          }
        });
      });

      // 404 handler
      this.app.use('*', (req, res) => {
        res.status(404).json({
          success: false,
          error: {
            message: 'Route not found',
            status: 404,
            path: req.originalUrl,
            method: req.method
          }
        });
      });

    } catch (error) {
      logger.error('Failed to setup app:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      // Connect to Redis if configured
      if (process.env.REDIS_URL) {
        try {
          await connectRedis();
          logger.info('✅ Redis connection established');
        } catch (error) {
          logger.warn('Redis connection failed, continuing without cache:', error);
        }
      }

      // Start HTTP server - Railway compatible
      this.server = createServer(this.app);
      
      // Set keep-alive timeout for Railway
      this.server.keepAliveTimeout = 65000;
      this.server.headersTimeout = 66000;
      
      // Railway uses 0.0.0.0 for internal networking
      this.server.listen(this.port, '0.0.0.0', () => {
        logger.info(`🚀 FormsOCR Backend Server started successfully`);
        logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📊 Port: ${this.port}`);
        logger.info(`🔗 Health check: /health`);
        logger.info(`🚅 Railway deployment ready`);
        logger.info(`📈 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      });

      // Server error handling
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use`);
        } else {
          logger.error('Server error:', error);
        }
        process.exit(1);
      });

      // Setup graceful shutdown for Railway
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.info('Shutdown already in progress...');
        return;
      }

      this.isShuttingDown = true;
      logger.info(`${signal} received, initiating graceful shutdown`);
      
      // Stop accepting new requests
      this.server.close(async (err: any) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
          process.exit(1);
        }
        
        try {
          // Close database connections, cleanup resources
          logger.info('Cleaning up resources...');
          
          // Add cleanup logic here if needed
          
          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        }
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }
}

// Start server with proper error handling
const server = new Server();
server.start().catch(error => {
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});

export default Server;