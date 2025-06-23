import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface UserCache {
  user_id: string;
  amount: number;
  amountUsedSlots: number;
  ban?: any[];
  username?: string;
  clan_nick?: string;
  jackPot?: number;
  lastUpdated: number;
}

export interface BotCache {
  jackPot: number;
  lastUpdated: number;
}

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis;

  private readonly USER_PREFIX = 'user:slots:';
  private readonly LOCK_PREFIX = 'lock:slots:';

  private readonly USER_TTL = 86400; // 1 day
  private readonly LOCK_TTL = 10;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async onApplicationShutdown() {
    await this.redis.quit();
  }

  async getUserCache(userId: string): Promise<UserCache | null> {
    try {
      const cached = await this.redis.get(`${this.USER_PREFIX}${userId}`);
      if (!cached) return null;

      return JSON.parse(cached) as UserCache;
    } catch (error) {
      this.logger.error(`Error getting user cache for ${userId}:`, error);
      return null;
    }
  }

  async setUserCache(userId: string, data: UserCache): Promise<void> {
    try {
      await this.redis.setex(
        `${this.USER_PREFIX}${userId}`,
        this.USER_TTL,
        JSON.stringify(data),
      );
    } catch (error) {
      this.logger.error(`Error setting user cache for ${userId}:`, error);
    }
  }

  async updateUserCache(
    userId: string,
    updates: Partial<UserCache>,
  ): Promise<void> {
    try {
      const existing = await this.getUserCache(userId);
      if (existing) {
        const updated = { ...existing, ...updates, lastUpdated: Date.now() };
        await this.setUserCache(userId, updated);
      }
    } catch (error) {
      this.logger.error(`Error updating user cache for ${userId}:`, error);
    }
  }

  async deleteUserCache(userId: string): Promise<void> {
    try {
      await this.redis.del(`${this.USER_PREFIX}${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting user cache for ${userId}:`, error);
    }
  }

  async acquireLock(
    key: string,
    ttl: number = this.LOCK_TTL,
  ): Promise<boolean> {
    try {
      const lockKey = `${this.LOCK_PREFIX}${key}`;
      const result = await this.redis.set(lockKey, '1', 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Error acquiring lock for ${key}:`, error);
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(`${this.LOCK_PREFIX}${key}`);
    } catch (error) {
      this.logger.error(`Error releasing lock for ${key}:`, error);
    }
  }

  async getUserCacheBatch(userIds: string[]): Promise<Map<string, UserCache>> {
    const result = new Map<string, UserCache>();

    if (userIds.length === 0) return result;

    try {
      const keys = userIds.map((id) => `${this.USER_PREFIX}${id}`);
      const values = await this.redis.mget(keys);

      for (let i = 0; i < userIds.length; i++) {
        if (values[i]) {
          try {
            result.set(userIds[i], JSON.parse(values[i]!));
          } catch (parseError) {
            this.logger.error(
              `Error parsing cache for user ${userIds[i]}:`,
              parseError,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error getting user cache batch:', error);
    }

    return result;
  }

  async setUserCacheBatch(users: Map<string, UserCache>): Promise<void> {
    if (users.size === 0) return;

    try {
      const pipeline = this.redis.pipeline();

      for (const [userId, data] of users) {
        pipeline.setex(
          `${this.USER_PREFIX}${userId}`,
          this.USER_TTL,
          JSON.stringify(data),
        );
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Error setting user cache batch:', error);
    }
  }

  async getCacheStats(): Promise<{
    userCacheKeys: number;
    activeLocks: number;
  }> {
    try {
      const [userKeys, lockKeys] = await Promise.all([
        this.redis.keys(`${this.USER_PREFIX}*`),
        this.redis.keys(`${this.LOCK_PREFIX}*`),
      ]);

      return {
        userCacheKeys: userKeys.length,
        activeLocks: lockKeys.length,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        userCacheKeys: 0,
        activeLocks: 0,
      };
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.USER_PREFIX}*`);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.logger.log('All slots cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }
}
