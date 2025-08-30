
import winston from 'winston';
import path from 'path';
import { promises as fs } from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

// Create logs directory asynchronously
const ensureLogsDir = async () => {
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch (error) {
    console.error('Could not create logs directory:', error);
  }
};

// Railway-optimized log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}] [${service || 'formsocr-backend'}]: ${message} ${metaStr}`;
  })
);

// Production format for structured logging
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

// Create base logger configuration
const baseTransports: winston.transport[] = [];

// Always add console transport
baseTransports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? productionFormat : consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
);

// Add file transports for production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Ensure logs directory exists before adding file transports
  ensureLogsDir().then(() => {
    // Add file transports after directory creation
    baseTransports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: productionFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: productionFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
      })
    );
  });
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'formsocr-backend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: baseTransports,
  exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections in production
if (process.env.NODE_ENV === 'production') {
  ensureLogsDir().then(() => {
    logger.exceptions.handle(
      new winston.transports.File({ 
        filename: path.join(logsDir, 'exceptions.log'),
        maxsize: 10485760,
        maxFiles: 3
      })
    );

    logger.rejections.handle(
      new winston.transports.File({ 
        filename: path.join(logsDir, 'rejections.log'),
        maxsize: 10485760,
        maxFiles: 3
      })
    );
  });
}

// Railway-specific logging utilities
export const railwayLogger = {
  startup: (port: number) => {
    logger.info('🚀 FormsOCR Backend Server started', {
      port,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    });
  },

  shutdown: (signal: string) => {
    logger.info(`🛑 Shutdown initiated by ${signal}`, {
      uptime: process.uptime(),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    });
  },

  request: (method: string, url: string, duration: number, statusCode: number, ip?: string) => {
    const logLevel = statusCode >= 400 ? 'warn' : 'info';
    logger.log(logLevel, `${method} ${url} - ${statusCode}`, {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  ocr: (engine: string, duration: number, success: boolean, confidence?: number) => {
    logger.info(`OCR processing ${success ? 'completed' : 'failed'}`, {
      engine,
      duration: `${duration}ms`,
      success,
      confidence: confidence ? `${(confidence * 100).toFixed(1)}%` : undefined
    });
  },

  error: (error: Error, context?: Record<string, any>) => {
    logger.error('Application error occurred', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  },

  performance: (operation: string, duration: number, metadata?: Record<string, any>) => {
    const logLevel = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger.log(logLevel, `Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  }
};

// Export default logger
export default logger;