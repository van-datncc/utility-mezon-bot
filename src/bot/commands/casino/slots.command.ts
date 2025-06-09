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
import { Repository } from 'typeorm';
import { getRandomColor } from 'src/bot/utils/helps';
import { EUserError } from 'src/bot/constants/error';
import { EmbedProps, FuncType } from 'src/bot/constants/configs';
import {
  JackPotTransaction,
  JackpotType,
} from 'src/bot/models/jackPotTransaction.entity';

const slotItems = [
  '1.JPG',
  '2.JPG',
  '3.JPG',
  '4.JPG',
  '5.JPG',
  '6.JPG',
  '7.JPG',
  '8.JPG',
  '9.JPG',
  '10.JPG',
  '11.JPG',
  '12.JPG',
  '13.JPG',
  '14.JPG',
];

@Command('slots')
export class SlotsCommand extends CommandMessage {
  private queue: ChannelMessage[] = [];
  private running = false;
  private UserSlotsMap: Map<string, any> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(JackPotTransaction)
    private jackPotTransaction: Repository<JackPotTransaction>,
    clientService: MezonClientService,
  ) {
    super(clientService);
    this.startWorker();
  }

  async getLast10JackpotWinners() {
    const rawData = await this.jackPotTransaction.find({
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
          username: findUser?.clan_nick || findUser?.username || '',
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
      .addSelect('COUNT(*)', 'totalTimes')
      .addSelect('SUM(jackpot.amount)', 'totalAmount')
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'jackPot' THEN 1 ELSE 0 END)`,
        'jackpotCount',
      )
      .where('jackpot.user_id = :userId', { userId })
      .groupBy('jackpot.user_id')
      .getRawOne();
  }

  async getTop5JackpotUsers() {
    const rawData = await this.jackPotTransaction
      .createQueryBuilder('jackpot')
      .select('jackpot.user_id', 'user_id')
      .addSelect('SUM(jackpot.amount)', 'totalamount')
      .addSelect('COUNT(*)', 'totalTimes')
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'win' THEN 1 ELSE 0 END)`,
        'winCount',
      )
      .addSelect(
        `SUM(CASE WHEN jackpot.type = 'jackPot' THEN 1 ELSE 0 END)`,
        'jackpotCount',
      )
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
          username: findUser?.clan_nick || findUser?.username || '',
          totalAmount: parseFloat(r.totalamount),
          totalTimes: parseInt(r.totalTimes, 10),
          totalUsed: +(findUser?.amountUsedSlots ?? 0),
          jackpotCount: +r.jackpotCount,
          winCount: +r.winCount,
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
          `${index + 1}. **${data.username}** nổ ${(+data.amount).toLocaleString('vi-VN')}đ lúc ${data.time}`,
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
      return await messageChannel?.reply({ embed });
    }
    if (args[0] === 'top5') {
      const messageChannel = await this.getChannelMessage(message);
      const top5List = await this.getTop5JackpotUsers();
      const messageArray: string[] = [];
      top5List.forEach((data, index) =>
        messageArray.push(
          `${index + 1}. **${data.username}** \n - Tổng số lần nổ: ${data.totalTimes} lần \n - Tổng lần nổ 777: ${data.jackpotCount} lần\n - Tổng tiền nhận được: ${data.totalAmount.toLocaleString('vi-VN')}đ \n - Tổng tiền đã dùng: ${data.totalUsed.toLocaleString('vi-VN')}đ`,
        ),
      );
      const messageContent = messageArray.length
        ? messageArray.join('\n\n')
        : 'Chưa có ai nổ hũ rồi! Mọi người *slots nhiều hơn nàoooo!';
      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `TOP 5 NGƯỜI NỔ HŨ NHIỀU NHẤT`,
          description:
            '```' +
            messageContent +
            '\n\n(Tiền đã nhận chưa tính những lần win 10.000đ)' +
            '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];
      return await messageChannel?.reply({ embed });
    }
    if (args[0] === 'check') {
      const messageChannel = await this.getChannelMessage(message);
      const username = args[1] ?? message.clan_nick;
      const findUser = await this.userRepository.findOne({
        where: { clan_nick: username },
      });
      if (!findUser) {
        return await messageChannel?.reply({ t: 'User not found!' });
      }
      const user = await this.getDataBuyUserId(findUser?.user_id);
      const messageContent = `- Tổng lần nổ hũ: ${user.totalTimes}\n- Tổng lần nổ 777: ${user.jackpotCount}\n- Tổng tiền đã nhận: ${(+user.totalAmount).toLocaleString('vi-VN')}đ\n- Tổng tiền đã chi: ${(+findUser.amountUsedSlots).toLocaleString('vi-VN')}đ\n\n(Tiền đã nhận chưa tính những lần win 10.000đ)`;
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
      return await messageChannel?.reply({ embed });
    }
    this.queue.push(message);
  }

  async setUserSlots(user_id: string, user: any) {
    if (!this.UserSlotsMap.has(user.user_id)) {
      this.UserSlotsMap.set(user.user_id, user);
    }
  }
  async getUserSlots(user_id: string) {
    return this.UserSlotsMap.get(user_id);
  }

  private async startWorker() {
    if (this.running) return;
    this.running = true;
    setInterval(async () => {
      if (this.queue.length === 0) return;
      const msg = this.queue.shift();
      if (msg) await this.processSlotMessage(msg);
    }, 15);
  }

  private async processSlotMessage(message: ChannelMessage) {
    try {
      const messageChannel = await this.getChannelMessage(message);
      const money = 5000;

      const [findUser, botInfo] = await Promise.all([
        this.userRepository.findOne({
          where: { user_id: message.sender_id },
        }),
        this.userRepository.findOne({
          where: { user_id: process.env.UTILITY_BOT_ID },
        }),
      ]);

      if (!findUser || !botInfo) {
        return await messageChannel?.reply({
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

      await Promise.all([
        this.setUserSlots(botInfo.user_id!, botInfo),
        this.setUserSlots(findUser.user_id!, findUser),
      ]);

      const userSlots = await this.getUserSlots(message.sender_id);
      const botSlots = await this.getUserSlots(
        process.env.UTILITY_BOT_ID as string,
      );

      if (!userSlots || !botSlots) {
        return await messageChannel?.reply({
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

      const activeBan = Array.isArray(userSlots.ban)
        ? findUser.ban.find(
            (ban) =>
              (ban.type === FuncType.SLOTS || ban.type === FuncType.ALL) &&
              ban.unBanTime > Math.floor(Date.now() / 1000),
          )
        : null;

      if (activeBan) {
        const unbanDate = new Date(activeBan.unBanTime * 1000);
        const formattedTime = unbanDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
        });
        const content = activeBan.note;
        const msgText = `❌ Bạn đang bị cấm thực hiện hành động "slots" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
        return await messageChannel?.reply({
          t: msgText,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: msgText.length }],
        });
      }

      if ((userSlots.amount || 0) < money || isNaN(userSlots.amount)) {
        return await messageChannel?.reply({
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

      let win = false;
      const number = [0, 0, 0];
      const results: string[][] = [];
      for (let i = 0; i < 3; i++) {
        number[i] = Math.floor(Math.random() * slotItems.length);
        const result = [...slotItems, slotItems[number[i]]];
        results.push(result);
      }

      let wonAmount = 0;
      const betMoney = Math.round(money * 0.9);
      let isJackPot = false;

      if (
        number[0] === number[1] &&
        number[1] === number[2] &&
        slotItems[number[0]] === '1.JPG'
      ) {
        wonAmount = botInfo.jackPot;
        isJackPot = true;
        win = true;
      } else if (number[0] === number[1] && number[1] === number[2]) {
        wonAmount = Math.floor(botInfo.jackPot * 0.3);
        win = true;
      } else if (new Set(number).size <= 2) {
        wonAmount = money * 2;
        if (botInfo.jackPot < betMoney * 2) {
          wonAmount = botInfo.jackPot;
          isJackPot = true;
        }
        win = true;
      }

      const userAmount = Number(userSlots.amount);
      const botAmount = Number(botSlots.amount);
      const botJackPot = Number(botSlots.jackPot);

      const newUserAmount = win ? userAmount + wonAmount : userAmount - money;
      let newJackPot = win ? botJackPot - wonAmount : botJackPot + betMoney;
      let newBotAmount = botAmount + (money - betMoney);

      if (isJackPot) {
        if (newBotAmount > 500000) {
          newJackPot = 500000;
          newBotAmount -= 500000;
        } else {
          newJackPot = newBotAmount;
          newBotAmount = 0;
        }
      }

      const updatedUserSlots = { ...userSlots, amount: newUserAmount };
      const updatedBotSlots = {
        ...botSlots,
        amount: newBotAmount,
        jackPot: newJackPot,
      };

      await Promise.all([
        this.UserSlotsMap.set(userSlots.user_id, updatedUserSlots),
        this.UserSlotsMap.set(
          process.env.UTILITY_BOT_ID as string,
          updatedBotSlots,
        ),
      ]);

      setTimeout(async () => {
        try {
          const values = Array.from(this.UserSlotsMap.values());
          if (values.length === 0) return;

          const updates = values.map(async (value) => {
            try {
              if (value.user_id === process.env.UTILITY_BOT_ID) {
                await this.userRepository.update(
                  { user_id: value.user_id },
                  {
                    amount: value.amount,
                    jackPot: value.jackPot,
                  },
                );
              } else {
                await this.userRepository.update(
                  { user_id: value.user_id },
                  {
                    amount: value.amount,
                    amountUsedSlots: +value.amountUsedSlots + money,
                  },
                );
              }
            } catch (err) {
              console.error(`Error updating user ${value.user_id}:`, err);
            } finally {
              this.UserSlotsMap.delete(value.user_id);
            }
          });

          await Promise.all(updates);
        } catch (err) {
          console.error('Error in database update timeout:', err);
        }
      }, 1000);

      if (win && wonAmount !== 10000) {
        try {
          await this.jackPotTransaction.insert({
            user_id: message.sender_id,
            amount: wonAmount,
            type: isJackPot ? JackpotType.JACKPOT : JackpotType.WIN,
            createAt: Date.now(),
            clan_id: message.clan_id,
            channel_id: message.channel_id,
          });

          const clan = this.client.clans.get('0');
          const user = await clan?.users.fetch('1827994776956309504');
          await user?.sendDM({
            t: `${message.sender_id} vừa nổ jackpot ${isJackPot ? '777' : ''} ${wonAmount}đ`,
          });
        } catch (err) {
          console.error('Error recording jackpot transaction:', err);
        }
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
                  'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420411527_0spritesheet.png',
                url_position:
                  'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420408191_0spritesheet.json',
                jackpot: botInfo.jackPot,
                pool: results,
                repeat: 6,
                duration: 0.5,
              },
            },
          },
        ],
      };

      const messBot = await messageChannel?.reply({ embed: [resultEmbed] });
      if (!messBot) return;

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
      const messageBot = await this.getChannelMessage(msg);

      setTimeout(() => {
        try {
          const msgResults = {
            color: getRandomColor(),
            title: '🎰 Kết quả Slots 🎰',
            description: `
                Jackpot: ${Math.floor(botSlots.jackPot)}
                Bạn đã cược: ${money}
                Bạn ${win ? 'thắng' : 'thua'}: ${win ? wonAmount : money}
                Jackpot mới: ${newJackPot}
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
                      'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420411527_0spritesheet.png',
                    url_position:
                      'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420408191_0spritesheet.json',
                    jackpot: Math.floor(botSlots.jackPot),
                    pool: results,
                    repeat: 6,
                    duration: 0.5,
                    isResult: 1,
                  },
                },
              },
            ],
          };
          messageBot?.update({ embed: [msgResults] });
        } catch (err) {
          console.error('Error updating result message:', err);
        }
      }, 4000);
    } catch (err) {
      console.error('Error in processSlotMessage:', err);
      const messageChannel = await this.getChannelMessage(message);
      await messageChannel?.reply({
        t: 'Đã xảy ra lỗi khi xử lý slots. Vui lòng thử lại sau.',
        mk: [{ type: EMarkdownType.PRE, s: 0, e: 50 }],
      });
    }
  }
}
