import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../models/user.entity';
import { RedisCacheService, UserCache } from './redis-cache.service';

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);

  private userCache = new Map<string, UserCache>();
  private readonly MEMORY_CACHE_TTL = 10000;
  private readonly CACHE_SYNC_INTERVAL = 60000;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private redisCacheService: RedisCacheService,
  ) {
    this.initializeCache();
  }

  private async initializeCache() {
    setInterval(() => {
      this.syncCacheToDatabase();
    }, this.CACHE_SYNC_INTERVAL);

    this.logger.log('UserCacheService initialized with periodic sync');
  }

  private async syncCacheToDatabase() {
    try {
      const updatePromises: Promise<any>[] = [];
      const syncedUsers: string[] = [];
      for (const [userId, userCache] of this.userCache) {
        if (Date.now() - userCache.lastUpdated < this.CACHE_SYNC_INTERVAL) {
          updatePromises.push(
            this.userRepository
              .update(
                { user_id: userId },
                {
                  amount: Number(userCache.amount),
                  amountUsedSlots: Number(userCache.amountUsedSlots || 0),
                  username: userCache.username,
                  clan_nick: userCache.clan_nick,
                  jackPot: Number(userCache.jackPot || 0),
                },
              )
              .then(() => {
                syncedUsers.push(userId);
              }),
          );
        }
      }

      await Promise.all(updatePromises); // check ?

      if (syncedUsers.length > 0) {
        this.logger.debug(`Synced ${syncedUsers.length} users to database`);
      }
    } catch (error) {
      this.logger.error('Error syncing cache to database:', error);
    }
  }

  async getUserFromCache(userId: string): Promise<UserCache | null> {
    try {
      const memoryCache = this.userCache.get(userId);
      if (
        memoryCache &&
        Date.now() - memoryCache.lastUpdated < this.MEMORY_CACHE_TTL
      ) {
        return memoryCache;
      }

      let redisCache = await this.redisCacheService.getUserCache(userId);

      if (redisCache) {
        this.userCache.set(userId, redisCache);
        return redisCache;
      }

      const user = await this.userRepository.findOne({
        where: { user_id: userId },
      });

      if (!user) {
        return null;
      }

      const userCache: UserCache = {
        user_id: user.user_id,
        amount: Number(user.amount) || 0,
        amountUsedSlots: Number(user.amountUsedSlots) || 0,
        ban: user.ban || [],
        username: user.username || '',
        clan_nick: user.clan_nick || '',
        jackPot: Number(user.jackPot) || 0,
        lastUpdated: Date.now(),
      };

      this.userCache.set(userId, userCache);
      await this.redisCacheService.setUserCache(userId, userCache);

      return userCache;
    } catch (error) {
      this.logger.error(`Error getting user cache for ${userId}:`, error);
      return null;
    }
  }

  async createUserIfNotExists(
    userId: string,
    username?: string,
    clanNick?: string,
  ): Promise<UserCache | null> {
    try {
      const existingUser = await this.getUserFromCache(userId);
      if (existingUser) {
        return existingUser;
      }

      const newUser = this.userRepository.create({
        user_id: userId,
        amount: 0,
        amountUsedSlots: 0,
        username: username || '',
        clan_nick: clanNick || '',
        ban: [],
      });
      await this.userRepository.save(newUser);

      const userCache: UserCache = {
        user_id: userId,
        amount: 0,
        amountUsedSlots: 0,
        ban: [],
        username: username || '',
        clan_nick: clanNick || '',
        jackPot: 0,
        lastUpdated: Date.now(),
      };

      this.userCache.set(userId, userCache);
      await this.redisCacheService.setUserCache(userId, userCache);
      return userCache;
    } catch (error) {
      this.logger.error(`Error creating user ${userId}:`, error);
      return null;
    }
  }

  async updateUserCache(
    userId: string,
    updates: Partial<UserCache>,
  ): Promise<void> {
    try {
      const cached = this.userCache.get(userId);
      if (cached) {
        Object.assign(cached, updates, { lastUpdated: Date.now() });
      }

      this.redisCacheService.updateUserCache(userId, updates).catch((error) => {
        this.logger.error(
          `Error updating Redis user cache for ${userId}:`,
          error,
        );
      });
    } catch (error) {
      this.logger.error(`Error updating user cache for ${userId}:`, error);
    }
  }

  async updateUserBalance(
    userId: string,
    amountChange: number,
    usedSlotsChange: number = 0,
    lockTimeout: number = 5,
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const lockKey = `user_balance_${userId}`;
    const lockAcquired = await this.redisCacheService.acquireLock(
      lockKey,
      lockTimeout,
    );

    if (!lockAcquired) {
      return {
        success: false,
        newBalance: 0,
        error: 'Unable to acquire lock for balance update',
      };
    }

    try {
      const user = await this.getUserFromCache(userId);
      if (!user) {
        return {
          success: false,
          newBalance: 0,
          error: 'User not found',
        };
      }

      const currentBalance = Number(user.amount) || 0;
      const newBalance = currentBalance + amountChange;

      if (newBalance < 0) {
        return {
          success: false,
          newBalance: currentBalance,
          error: 'Insufficient balance',
        };
      }

      const newUsedSlots = Number(user.amountUsedSlots || 0) + usedSlotsChange;

      await this.updateUserCache(userId, {
        amount: newBalance,
        amountUsedSlots: Math.max(0, newUsedSlots),
      });

      // await this.userRepository.update(
      //   { user_id: userId },
      //   {
      //     amount: newBalance,
      //     amountUsedSlots: Math.max(0, newUsedSlots),
      //   },
      // );

      return {
        success: true,
        newBalance: newBalance,
      };
    } catch (error) {
      this.logger.error(`Error updating balance for ${userId}:`, error);
      return {
        success: false,
        newBalance: 0,
        error: error.message || 'Unknown error',
      };
    } finally {
      await this.redisCacheService.releaseLock(lockKey);
    }
  }

  async getUserBalance(
    userId: string,
  ): Promise<{ balance: number; error?: string }> {
    try {
      const user = await this.getUserFromCache(userId);
      if (!user) {
        return {
          balance: 0,
          error: 'User not found',
        };
      }

      return {
        balance: Number(user.amount) || 0,
      };
    } catch (error) {
      this.logger.error(`Error getting balance for ${userId}:`, error);
      return {
        balance: 0,
        error: error.message || 'Unknown error',
      };
    }
  }

  async hasEnoughBalance(
    userId: string,
    requiredAmount: number,
  ): Promise<boolean> {
    const { balance } = await this.getUserBalance(userId);
    return balance >= requiredAmount;
  }

  async getUserBanStatus(
    userId: string,
    funcType: string,
  ): Promise<{
    isBanned: boolean;
    banInfo?: any;
  }> {
    try {
      const user = await this.getUserFromCache(userId);
      if (!user || !Array.isArray(user.ban)) {
        return { isBanned: false };
      }

      const activeBan = user.ban.find(
        (ban) =>
          (ban.type === funcType || ban.type === 'ALL') &&
          ban.unBanTime > Math.floor(Date.now() / 1000),
      );

      return {
        isBanned: !!activeBan,
        banInfo: activeBan,
      };
    } catch (error) {
      this.logger.error(`Error checking ban status for ${userId}:`, error);
      return { isBanned: false };
    }
  }

  async clearUserCache(userId: string): Promise<void> {
    try {
      this.userCache.delete(userId);
      await this.redisCacheService.deleteUserCache(userId);
      this.logger.log(`Cleared cache for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Error clearing cache for ${userId}:`, error);
    }
  }

  async getCacheStats(): Promise<{
    memoryUserCount: number;
    redisStats: any;
  }> {
    try {
      const redisStats = await this.redisCacheService.getCacheStats();
      return {
        memoryUserCount: this.userCache.size,
        redisStats,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        memoryUserCount: this.userCache.size,
        redisStats: {},
      };
    }
  }

  async forceSyncUser(userId: string): Promise<void> {
    try {
      const user = this.userCache.get(userId);
      if (user) {
        await this.userRepository.update(
          { user_id: userId },
          {
            amount: Number(user.amount),
            amountUsedSlots: Number(user.amountUsedSlots || 0),
            username: user.username,
            clan_nick: user.clan_nick,
            jackPot: Number(user.jackPot || 0),
          },
        );
        this.logger.debug(`Force synced user ${userId} to database`);
      }
    } catch (error) {
      this.logger.error(`Error force syncing user ${userId}:`, error);
    }
  }

  async clearAllMemoryCache(): Promise<{
    success: boolean;
    clearedCount: number;
    error?: string;
  }> {
    try {
      await this.syncCacheToDatabase();

      const clearedCount = this.userCache.size;
      this.userCache.clear();

      this.logger.log(`Cleared all memory cache (${clearedCount} users)`);

      return {
        success: true,
        clearedCount,
      };
    } catch (error) {
      this.logger.error('Error clearing all memory cache:', error);
      return {
        success: false,
        clearedCount: 0,
        error: error.message || 'Unknown error',
      };
    }
  }
}
