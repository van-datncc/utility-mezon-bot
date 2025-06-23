import { InjectRepository } from '@nestjs/typeorm';
import {
  ChannelMessage,
  EMarkdownType,
  EMessageComponentType,
} from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Not, Repository } from 'typeorm';
import { getRandomColor } from 'src/bot/utils/helps';
import { EUserError } from 'src/bot/constants/error';
import { EmbedProps, FuncType } from 'src/bot/constants/configs';
import {
  JackPotTransaction,
  JackpotType,
} from 'src/bot/models/jackPotTransaction.entity';
import { RedisCacheService } from 'src/bot/services/redis-cache.service';
import { BaseQueueProcessor } from 'src/bot/base/queue-processor.base';
import { UserCacheService } from 'src/bot/services/user-cache.service';
import { ReplyStatsService } from 'src/bot/services/reply-stats.service';

const slotItems = [
  '0.png',
  '1.png',
  '2.png',
  '3.png',
  '4.png',
  '5.png',
  '6.png',
  '7.png',
  '8.png',
  '9.png',
  '10.png',
  '11.png',
  '12.png',
  '13.png',
  '14.png',
  '15.png',
];

@Command('slots')
export class SlotsCommand extends CommandMessage {
  private queueProcessor: BaseQueueProcessor<ChannelMessage>;
  private notifiedUsers: Map<string, number> = new Map();
  private readonly QUEUE_LIMIT = 50;
  private readonly NOTIFICATION_CLEAR_THRESHOLD = 20;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(JackPotTransaction)
    private jackPotTransaction: Repository<JackPotTransaction>,
    private redisCacheService: RedisCacheService,
    private userCacheService: UserCacheService,
    private replyStatsService: ReplyStatsService,
    clientService: MezonClientService,
  ) {
    super(clientService);

    this.queueProcessor =
      new (class extends BaseQueueProcessor<ChannelMessage> {
        constructor(private slotsCommand: SlotsCommand) {
          super('SlotsCommand', 1, 25000);
        }

        protected async processItem(message: ChannelMessage): Promise<void> {
          await this.slotsCommand.processSlotMessage(message);
        }

        protected async handleProcessingError(
          message: ChannelMessage,
          error: any,
        ): Promise<void> {
          this.logger.error(`Failed to process slot message:`, {
            userId: message.sender_id,
            messageId: message.message_id,
            error: error.message,
          });

          const messageChannel =
            await this.slotsCommand.getChannelMessage(message);
          const errorMessage =
            'Có lỗi xảy ra khi chơi slots. Vui lòng thử lại sau.';
          await messageChannel?.reply({
            t: errorMessage,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: errorMessage.length }],
          });
        }
      })(this);
  }

  private async getBotJackpot(): Promise<number> {
    const botId = process.env.UTILITY_BOT_ID;
    if (!botId) {
      throw new Error('UTILITY_BOT_ID is not defined');
    }

    const botCache = await this.userCacheService.getUserFromCache(botId);
    if (!botCache) {
      const newBotCache = await this.userCacheService.createUserIfNotExists(
        botId,
        'UtilityBot',
        'UtilityBot',
      );
      return Number(newBotCache?.jackPot) || 0;
    }

    return Number(botCache.jackPot) || 0;
  }

  private async updateBotJackpot(
    newJackpot: number,
    lockKey: string,
  ): Promise<boolean> {
    const botId = process.env.UTILITY_BOT_ID;
    if (!botId) {
      throw new Error('UTILITY_BOT_ID is not defined');
    }

    const jackpotLockKey = `jackpot_${botId}`;
    const lockAcquired = await this.redisCacheService.acquireLock(
      jackpotLockKey,
      10,
    );

    if (!lockAcquired) {
      return false;
    }

    try {
      await this.userCacheService.updateUserCache(botId, {
        jackPot: Number(newJackpot),
      });
      return true;
    } finally {
      await this.redisCacheService.releaseLock(jackpotLockKey);
    }
  }

  async getLast10JackpotWinners() {
    const rawData = await this.jackPotTransaction.find({
      where: {
        type: Not(JackpotType.REGULAR),
      },
      order: { createAt: 'DESC' },
      take: 10,
    });
    return await Promise.all(
      rawData.map(async (r) => {
        const findUser = await this.userRepository.findOne({
          where: { user_id: r.user_id },
        });
        const date = new Date(+r.createAt);
        return {
          user_id: r.user_id,
          username: findUser?.username || '',
          amount: r.amount,
          type: r.type,
          time: date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        };
      }),
    );
  }

  async getDataBuyUserId(userId: string) {
    return await this.jackPotTransaction
      .createQueryBuilder('jackpot')
      .select('jackpot.user_id', 'user_id')
      .addSelect(
        `SUM(CASE WHEN jackpot.type != :regularType THEN 1 ELSE 0 END)`,
        'totalTimes',
      )
      .addSelect('SUM(jackpot.amount)', 'totalAmount')
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'jackPot' THEN 1 ELSE 0 END)`,
        'jackpotCount',
      )
      .addSelect(
        `SUM(CASE WHEN jackpot.type != :regularType THEN jackpot.amount ELSE 0 END)`,
        'totalAmountJackPot',
      )
      .where('jackpot.user_id = :userId', {
        userId,
        regularType: JackpotType.REGULAR,
      })
      .groupBy('jackpot.user_id')
      .getRawOne();
  }

  async getTop5JackpotUsers() {
    const rawData = await this.jackPotTransaction
      .createQueryBuilder('jackpot')
      .select('jackpot.user_id', 'user_id')
      .addSelect('SUM(jackpot.amount)', 'totalamount')
      .addSelect(
        `SUM(CASE WHEN jackpot.amount != 10000 THEN 1 ELSE 0 END)`,
        'totalTimes',
      )
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'win' THEN 1 ELSE 0 END)`,
        'winCount',
      )
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'jackPot' THEN 1 ELSE 0 END)`,
        'jackpotCount',
      )
      .where('jackpot.type != :type', { type: JackpotType.REGULAR })
      .groupBy('jackpot.user_id')
      .orderBy('totalamount', 'DESC')
      .limit(5)
      .getRawMany();
    return await Promise.all(
      rawData.map(async (r) => {
        const findUser = await this.userRepository.findOne({
          where: { user_id: r.user_id },
        });
        return {
          user_id: r.user_id,
          username: findUser?.username || '',
          totalAmount: parseFloat(r.totalamount) || 0,
          totalTimes: parseInt(r.totalTimes, 10) || 0,
          totalUsed: +(findUser?.amountUsedSlots || 0),
          jackpotCount: +(r.jackpotCount || 0),
          winCount: +(r.winCount || 0),
        };
      }),
    );
  }

  async execute(args: string[], message: ChannelMessage) {
    if (args[0] === 'top10') {
      const messageChannel = await this.getChannelMessage(message);
      const top10List = await this.getLast10JackpotWinners();
      const messageArray: string[] = [];
      top10List.forEach((data, index) =>
        messageArray.push(
          `${index + 1}. ${data.type === JackpotType.JACKPOT ? ` [ 777 ] ` : ''} **${data.username}** nổ ${(+data.amount).toLocaleString('vi-VN')}đ lúc ${data.time}`,
        ),
      );
      const messageContent = messageArray.length
        ? messageArray.join('\n\n')
        : 'Chưa có ai nổ hũ rồi! Mọi người *slots nhiều hơn nàoooo!';
      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `TOP 10 NGƯỜI NỔ HŨ GẦN NHẤT`,
          description: '```' + messageContent + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];
      return await this.trackReplyAndSend(messageChannel, { embed });
    }
    if (args[0] === 'top5') {
      const messageChannel = await this.getChannelMessage(message);
      const top5List = await this.getTop5JackpotUsers();
      const messageArray: string[] = [];
      top5List.forEach((data, index) =>
        messageArray.push(
          `${index + 1}. **${data.username}** \n - Tổng số lần nổ: ${data.totalTimes} lần \n - Tổng lần nổ 777: ${data.jackpotCount} lần\n - Tổng tiền nhận được: ${(+(data?.totalAmount ?? 0)).toLocaleString('vi-VN')}đ`,
        ),
      );
      const messageContent = messageArray.length
        ? messageArray.join('\n\n')
        : 'Chưa có ai nổ hũ rồi! Mọi người *slots nhiều hơn nàoooo!';
      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `TOP 5 NGƯỜI NỔ HŨ NHIỀU NHẤT`,
          description: '```' + messageContent + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];
      return await this.trackReplyAndSend(messageChannel, { embed });
    }
    if (args[0] === 'check') {
      const messageChannel = await this.getChannelMessage(message);
      const username = args[1] ?? message.username;
      let findUser = await this.userRepository.findOne({
        where: { clan_nick: username },
      });

      if (!findUser) {
        findUser = await this.userRepository.findOne({
          where: { username: username },
        });
      }
      if (!findUser) {
        return await this.trackReplyAndSend(messageChannel, {
          t: 'User not found!',
        });
      }
      const user = await this.getDataBuyUserId(findUser?.user_id);
      const messageContent = `- Tổng lần nổ hũ: ${user?.totalTimes ?? '0'}\n- Tổng lần nổ 777: ${user?.jackpotCount ?? '0'}\n- Tổng tiền đã nhận: ${(+(user?.totalAmount ?? 0)).toLocaleString('vi-VN')}đ\n- Tổng tiền nổ hũ đã nhận: ${(+(user?.totalAmountJackPot ?? 0)).toLocaleString('vi-VN')}đ`;
      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `${username}'s jackPot information`,
          description: '```' + messageContent + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];
      return await this.trackReplyAndSend(messageChannel, { embed });
    }

    if (args[0] === 'info') {
      const messageChannel = await this.getChannelMessage(message);

      try {
        const cacheStats = await this.userCacheService.getCacheStats();
        const queueStats = this.getQueueStats();
        const currentJackpot = await this.getBotJackpot();

        const infoMessage =
          `🔍 **System Information**\n\n` +
          `📊 **Memory Cache:**\n` +
          `- Users in memory: ${cacheStats.memoryUserCount}\n\n` +
          `🔄 **Queue Status:**\n` +
          `- Queue length: ${queueStats.queueLength}\n` +
          `- Is processing: ${queueStats.isProcessing ? 'Yes' : 'No'}\n` +
          `- Max concurrent: ${queueStats.maxConcurrentProcessing}\n\n` +
          `🔗 **Redis Cache:**\n` +
          `- User cache keys: ${cacheStats.redisStats.userCacheKeys || 0}\n` +
          `- Bot cache exists: ${cacheStats.redisStats.botCacheExists ? 'Yes' : 'No'}\n` +
          `- Active locks: ${cacheStats.redisStats.activeLocks || 0}\n\n` +
          `💰 **Bot Status:**\n` +
          `- Current jackpot: ${currentJackpot.toLocaleString('vi-VN')}đ`;

        const embed: EmbedProps[] = [
          {
            color: getRandomColor(),
            title: '📈 System Information',
            description: '```' + infoMessage + '```',
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Powered by Mezon',
              icon_url:
                'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
            },
          },
        ];

        return await this.trackReplyAndSend(messageChannel, { embed });
      } catch (error) {
        const errorMessage = `❌ **Error getting system info:**\n\n${error.message}`;
        return await this.trackReplyAndSend(messageChannel, {
          t: errorMessage,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: errorMessage.length }],
        });
      }
    }

    if (args[0] === 'cache') {
      const messageChannel = await this.getChannelMessage(message);

      try {
        const actualLimit = 500;

        const cachedUsersData =
          await this.userCacheService.getAllCachedUsers(actualLimit);

        if (cachedUsersData.users.length === 0) {
          const noUsersMessage = '❌ **Không có users nào trong cache**';
          return await this.trackReplyAndSend(messageChannel, {
            t: noUsersMessage,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: noUsersMessage.length }],
          });
        }

        const usersList = cachedUsersData.users
          .map(
            (user, index) =>
              `${index + 1}. **${user.username}** \n` +
              `   - UserID: ${user.userId}\n` +
              `   - Balance: ${user.balance.toLocaleString('vi-VN')}đ\
              n` +
              `   - Last Updated: ${user.lastUpdated}`,
          )
          .join('\n\n');

        const cacheMessage =
          `👥 **Cached Users List** (${actualLimit}/${cachedUsersData.totalCount})\n\n` +
          usersList;

        const embed: EmbedProps[] = [
          {
            color: getRandomColor(),
            title: '💾 Users Cache List',
            description: '```' + cacheMessage + '```',
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Powered by Mezon',
              icon_url:
                'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
            },
          },
        ];

        return await this.trackReplyAndSend(messageChannel, { embed });
      } catch (error) {
        const errorMessage = `❌ **Error getting cache list:**\n\n${error.message}`;
        return await this.trackReplyAndSend(messageChannel, {
          t: errorMessage,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: errorMessage.length }],
        });
      }
    }

    if (args[0] === 'replystats') {
      const messageChannel = await this.getChannelMessage(message);

      try {
        const limit = args[1] ? parseInt(args[1]) : 50;
        const actualLimit = Math.min(Math.max(limit, 1), 100);

        const replyStats = this.replyStatsService.getReplyStats(actualLimit);
        const currentRate = this.replyStatsService.getCurrentReplyRate();
        const statsInfo = this.replyStatsService.getStatsInfo();

        if (replyStats.length === 0) {
          const noStatsMessage = '❌ **Chưa có dữ liệu thống kê reply**';
          return await this.trackReplyAndSend(messageChannel, {
            t: noStatsMessage,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: noStatsMessage.length }],
          });
        }

        const statsList = replyStats
          .map(
            (stat, index) =>
              `${index + 1}. ${stat.formattedTime} - ${stat.count} replies`,
          )
          .join('\n');

        const statsMessage =
          `📊 **Bot Reply Statistics**\n\n` +
          `🔄 **Current Rate:**\n` +
          `- Current second: ${currentRate.currentSecond} replies\n` +
          `- Last minute: ${currentRate.lastMinuteTotal} replies\n` +
          `- Last 10 minutes: ${currentRate.last10MinutesTotal} replies\n\n` +
          `📈 **Memory Stats:**\n` +
          `- Total entries: ${statsInfo.totalEntries}\n` +
          `- Oldest entry: ${statsInfo.oldestEntry || 'N/A'}\n` +
          `- Newest entry: ${statsInfo.newestEntry || 'N/A'}\n\n` +
          `📈 **Recent History (${actualLimit} seconds):**\n` +
          statsList;

        const embed: EmbedProps[] = [
          {
            color: getRandomColor(),
            title: '📊 Bot Reply Statistics',
            description: '```' + statsMessage + '```',
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Powered by Mezon',
              icon_url:
                'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
            },
          },
        ];

        return await this.trackReplyAndSend(messageChannel, { embed });
      } catch (error) {
        const errorMessage = `❌ **Error getting reply stats:**\n\n${error.message}`;
        return await this.trackReplyAndSend(messageChannel, {
          t: errorMessage,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: errorMessage.length }],
        });
      }
    }
    await this.checkAndNotifyQueueBusy(message);
    await (this.queueProcessor as any).addToQueue(message);
  }

  public async processSlotMessage(message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const money = 5000;

    const lockKey = `slot_${message.sender_id}`;
    const lockAcquired = await this.redisCacheService.acquireLock(lockKey, 5);

    if (!lockAcquired) {
      return await this.trackReplyAndSend(messageChannel, {
        t: 'Bạn đang chơi slots quá nhanh! Vui lòng chờ 5 giây.',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 50 }],
      });
    }

    try {
      const findUser = await this.userCacheService.getUserFromCache(
        message.sender_id,
      );

      if (!findUser) {
        return await this.trackReplyAndSend(messageChannel, {
          t: EUserError.INVALID_USER,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: EUserError.INVALID_USER.length,
            },
          ],
        });
      }

      const banStatus = await this.userCacheService.getUserBanStatus(
        message.sender_id,
        FuncType.SLOTS,
      );

      if (banStatus.isBanned && banStatus.banInfo) {
        const unbanDate = new Date(banStatus.banInfo.unBanTime * 1000);
        const formattedTime = unbanDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
        });
        const content = banStatus.banInfo.note;
        const msgText = `❌ Bạn đang bị cấm thực hiện hành động "slots" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
        return await this.trackReplyAndSend(messageChannel, {
          t: msgText,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: msgText.length }],
        });
      }

      const hasEnoughBalance = await this.userCacheService.hasEnoughBalance(
        message.sender_id,
        money,
      );

      if (!hasEnoughBalance) {
        return await this.trackReplyAndSend(messageChannel, {
          t: EUserError.INVALID_AMOUNT,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: EUserError.INVALID_AMOUNT.length,
            },
          ],
        });
      }

      const currentJackPot = await this.getBotJackpot();

      let win = false;
      let number = [0, 0, 0];
      const results: string[][] = [];
      for (let i = 0; i < 3; i++) {
        number[i] = Math.floor(Math.random() * slotItems.length);
        const result = [...slotItems, slotItems[number[i]]];
        results.push(result);
      }

      let wonAmount = 0;
      const betMoney = Math.round(money * 0.9);
      let isJackPot = false;
      let typeWin;

      if (
        number[0] === number[1] &&
        number[1] === number[2] &&
        slotItems[number[0]] === '0.png'
      ) {
        wonAmount = Math.floor(currentJackPot * 0.8);
        isJackPot = true;
        win = true;
        typeWin = JackpotType.JACKPOT;
      } else if (number[0] === number[1] && number[1] === number[2]) {
        wonAmount = Math.floor(currentJackPot * 0.3);
        win = true;
        typeWin = JackpotType.WIN;
      } else if (new Set(number).size <= 2) {
        wonAmount = money * 2;
        if (currentJackPot < betMoney * 2) {
          wonAmount = currentJackPot;
          isJackPot = true;
        }
        win = true;
        typeWin = JackpotType.REGULAR;
      }

      const newJackPot = win
        ? currentJackPot - wonAmount - Math.round(money * 0.1)
        : currentJackPot + betMoney;

      const balanceResult = await this.userCacheService.updateUserBalance(
        message.sender_id,
        win ? wonAmount : -money,
        win ? 0 : money,
        10,
      );

      if (!balanceResult.success) {
        const errorMessage = balanceResult.error || EUserError.INVALID_AMOUNT;
        return await this.trackReplyAndSend(messageChannel, {
          t: errorMessage,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: errorMessage.length,
            },
          ],
        });
      }

      await this.updateBotJackpot(newJackPot, lockKey);

      if (win) {
        this.jackPotTransaction
          .insert({
            user_id: message.sender_id,
            amount: Number(wonAmount),
            type: typeWin,
            createAt: Date.now(),
            clan_id: message.clan_id,
            channel_id: message.channel_id,
          })
          .then(async () => {
            if (wonAmount === money * 2) return;
            const clan = this.client.clans.get('0');
            const user = await clan?.users.fetch('1827994776956309504');
            await user?.sendDM({
              t: `${message.sender_id} vửa nổ jackpot ${isJackPot ? `777 ` : ''}${wonAmount}đ`,
            });
          })
          .catch((error) => {
            console.error('Error inserting jackpot transaction:', error);
          });
      }

      const resultEmbed = {
        color: getRandomColor(),
        title: '🎰 Kết quả Slots 🎰',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `slots`,
              type: EMessageComponentType.ANIMATION,
              component: {
                url_image:
                  'https://cdn.mezon.ai/0/1834156727516270592/1805415525119955000/1750654919810_1slots.png',
                url_position:
                  'https://cdn.mezon.ai/0/1834156727516270592/1805415525119955000/1750654919802_slots.json',
                jackpot: Number(currentJackPot),
                pool: results,
                repeat: 3,
                duration: 0.35,
              },
            },
          },
        ],
      };

      const messBot = await this.trackReplyAndSend(messageChannel, {
        embed: [resultEmbed],
      });

      const msg: ChannelMessage = {
        mode: messBot.mode,
        message_id: messBot.message_id,
        code: messBot.code,
        create_time: messBot.create_time,
        update_time: messBot.update_time,
        id: messBot.message_id,
        clan_id: message.clan_id,
        channel_id: message.channel_id,
        persistent: messBot.persistence,
        channel_label: message.channel_label,
        content: {},
        sender_id: process.env.UTILITY_BOT_ID as string,
      };
      this.getChannelMessage(msg).then((messageBot) => {
        const msgResults = {
          color: getRandomColor(),
          title: '🎰 Kết quả Slots 🎰',
          description: `
            Jackpot: ${Math.floor(Number(currentJackPot))}
            Bạn đã cược: ${money}
            Bạn ${win ? 'thắng' : 'thua'}: ${win ? wonAmount : money}
            Jackpot mới: ${Math.floor(Number(newJackPot))}
            `,
          fields: [
            {
              name: '',
              value: '',
              inputs: {
                id: `slots`,
                type: EMessageComponentType.ANIMATION,
                component: {
                  url_image:
                    'https://cdn.mezon.ai/0/1834156727516270592/1805415525119955000/1750654919810_1slots.png',
                  url_position:
                    'https://cdn.mezon.ai/0/1834156727516270592/1805415525119955000/1750654919802_slots.json',
                  jackpot: Math.floor(Number(currentJackPot)),
                  pool: results,
                  repeat: 3,
                  duration: 0.35,
                  isResult: 1,
                },
              },
            },
          ],
        };

        setTimeout(() => {
          messageBot?.update({ embed: [msgResults] });
          this.replyStatsService.trackReply();
        }, 300);
      });
    } finally {
      await this.redisCacheService.releaseLock(lockKey);
    }
  }

  public getQueueStats() {
    return this.queueProcessor.getQueueStats();
  }

  private cleanupNotificationCache(): void {
    const currentTime = Date.now();
    const fiveMinutesAgo = currentTime - 5 * 60 * 1000;

    for (const [userId, notifiedTime] of this.notifiedUsers.entries()) {
      if (notifiedTime < fiveMinutesAgo) {
        this.notifiedUsers.delete(userId);
      }
    }
  }

  private async checkAndNotifyQueueBusy(
    message: ChannelMessage,
  ): Promise<boolean> {
    this.cleanupNotificationCache();

    const queueStats = this.getQueueStats();
    const currentTime = Date.now();

    if (queueStats.queueLength <= this.NOTIFICATION_CLEAR_THRESHOLD) {
      this.notifiedUsers.clear();
    }

    if (queueStats.queueLength > this.QUEUE_LIMIT) {
      const lastNotifiedTime = this.notifiedUsers.get(message.sender_id) || 0;
      const timeSinceLastNotification = currentTime - lastNotifiedTime;

      if (timeSinceLastNotification > 30000) {
        const messageChannel = await this.getChannelMessage(message);
        const busyMessage =
          `**Bot đang xử lí lượt chơi của bạn, vui lòng đợi!**\n\n` +
          `Thông tin queue:\n` +
          `- Số lượt chờ: ${queueStats.queueLength}\n` +
          `Lượt chơi của bạn sẽ được xử lí theo thứ tự.`;

        await this.trackReplyAndSend(messageChannel, {
          t: busyMessage,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: busyMessage.length }],
        });

        this.notifiedUsers.set(message.sender_id, currentTime);
        return true;
      }
    }

    return false;
  }

  private async trackReplyAndSend(messageChannel: any, content: any) {
    this.replyStatsService.trackReply();
    return await messageChannel?.reply(content);
  }
}
