
import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export const connectRedis = async (): Promise<Redis | null> => {
  try {
    if (!process.env.REDIS_URL) {
      logger.info('No Redis URL provided, skipping Redis connection');
      return null;
    }

    // Railway Redis configuration
    const redisOptions = {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 60000,
      commandTimeout: 5000,
      family: 4, // Force IPv4
      keepAlive: 30000
    };

    redisClient = new Redis(process.env.REDIS_URL, redisOptions);

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis is ready to receive commands');
    });

    redisClient.on('error', (error: Error) => {
      logger.error('❌ Redis connection error:', error.message);
    });

    redisClient.on('close', () => {
      logger.warn('⚠️ Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis ping successful');
    
    return redisClient;

  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error);
    redisClient = null;
    return null;
  }
};

export const getRedisClient = (): Redis | null => {
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('✅ Redis connection closed gracefully');
    } catch (error) {
      logger.error('❌ Error closing Redis connection:', error);
    } finally {
      redisClient = null;
    }
  }
};

// Cache utility functions
export const cacheSet = async (key: string, value: any, ttl?: number): Promise<boolean> => {
  if (!redisClient) return false;
  
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error('Cache set error:', error);
    return false;
  }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redisClient) return null;
  
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
};

export const cacheDelete = async (key: string): Promise<boolean> => {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Cache delete error:', error);
    return false;
  }
};