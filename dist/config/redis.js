"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = exports.connectRedis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
let redisClient = null;
const connectRedis = async () => {
    try {
        if (!process.env.REDIS_URL) {
            logger_1.logger.info('No Redis URL provided, skipping Redis connection');
            return null;
        }
        redisClient = new ioredis_1.default(process.env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        redisClient.on('connect', () => {
            logger_1.logger.info('Redis connected successfully');
        });
        redisClient.on('error', (error) => {
            logger_1.logger.error('Redis connection error:', error);
        });
        await redisClient.connect();
        return redisClient;
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to Redis:', error);
        return null;
    }
};
exports.connectRedis = connectRedis;
const getRedisClient = () => {
    return redisClient;
};
exports.getRedisClient = getRedisClient;
