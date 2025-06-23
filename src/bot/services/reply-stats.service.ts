import { Injectable, Logger } from '@nestjs/common';

export interface ReplyStatsData {
  timestamp: number;
  count: number;
  formattedTime: string;
}

@Injectable()
export class ReplyStatsService {
  private readonly logger = new Logger(ReplyStatsService.name);
  private replyStats = new Map<
    number,
    { count: number; formattedTime: string }
  >();
  private readonly MAX_ENTRIES = 1000;

  constructor() {
    setInterval(() => {
      this.cleanupOldEntries();
    }, 60000);
  }

  trackReply(): void {
    const now = new Date();
    const currentSecond = Math.floor(now.getTime() / 1000);

    const existing = this.replyStats.get(currentSecond);
    if (existing) {
      existing.count++;
    } else {
      const formattedTime = now.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      });

      this.replyStats.set(currentSecond, {
        count: 1,
        formattedTime,
      });
    }
  }

  getReplyStats(limit: number = 100): ReplyStatsData[] {
    const entries = Array.from(this.replyStats.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        count: data.count,
        formattedTime: data.formattedTime,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return entries;
  }

  getCurrentReplyRate(): {
    currentSecond: number;
    lastMinuteTotal: number;
    last10MinutesTotal: number;
  } {
    const now = Math.floor(Date.now() / 1000);
    const currentSecondStats = this.replyStats.get(now);

    let lastMinuteTotal = 0;
    let last10MinutesTotal = 0;

    // Calculate totals for different time periods
    for (let i = 0; i < 600; i++) {
      // 10 minutes = 600 seconds
      const timestamp = now - i;
      const stats = this.replyStats.get(timestamp);

      if (stats) {
        last10MinutesTotal += stats.count;
        if (i < 60) {
          // Last minute
          lastMinuteTotal += stats.count;
        }
      }
    }

    return {
      currentSecond: currentSecondStats?.count || 0,
      lastMinuteTotal,
      last10MinutesTotal,
    };
  }

  getStatsInfo(): {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const entries = Array.from(this.replyStats.entries());

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    entries.sort((a, b) => a[0] - b[0]); // Sort by timestamp

    return {
      totalEntries: entries.length,
      oldestEntry: entries[0][1].formattedTime,
      newestEntry: entries[entries.length - 1][1].formattedTime,
    };
  }

  private cleanupOldEntries(): void {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - this.MAX_ENTRIES;

    let removedCount = 0;
    for (const [timestamp] of this.replyStats) {
      if (timestamp < cutoff) {
        this.replyStats.delete(timestamp);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Cleaned up ${removedCount} old reply stats entries`);
    }
  }
}
