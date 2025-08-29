
import Redis from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export const connectRedis = async (): Promise<Redis | null> => {
  try {
    if (!process.env.REDIS_URL) {
      logger.info('No Redis URL provided, skipping Redis connection');
      return null;
    }

    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (error: Error) => {
      logger.error('Redis connection error:', error);
    });

    await redisClient.connect();
    return redisClient;

  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return null;
  }
};

export const getRedisClient = (): Redis | null => {
  return redisClient;
};