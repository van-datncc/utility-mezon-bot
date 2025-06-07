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
import { FuncType } from 'src/bot/constants/configs';
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

  async execute(args: string[], message: ChannelMessage) {
    this.queue.push(message);
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
    const messageChannel = await this.getChannelMessage(message);
    const money = 5000;

    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    const botInfo = await this.userRepository.findOne({
      where: { user_id: process.env.UTILITY_BOT_ID },
    });

    if (!findUser || !botInfo) {
      return await messageChannel?.reply({
        t: EUserError.INVALID_USER,
        mk: [
          { type: EMarkdownType.PRE, s: 0, e: EUserError.INVALID_USER.length },
        ],
      });
    }

    const activeBan = Array.isArray(findUser.ban)
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

    if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
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

    const userAmount = Number(findUser.amount);
    const botAmount = Number(botInfo.amount);
    const botJackPot = Number(botInfo.jackPot);

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

    await Promise.all([
      this.userRepository.update(
        { user_id: message.sender_id },
        { amount: newUserAmount },
      ),
      this.userRepository.update(
        { user_id: process.env.UTILITY_BOT_ID },
        { amount: newBotAmount, jackPot: newJackPot },
      ),
    ]);

    if (win && wonAmount !== 10000) {
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
        t: `${message.sender_id} vửa nổ jackpot ${isJackPot ? '777' : ''} ${wonAmount}đ`,
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
      const msgResults = {
        color: getRandomColor(),
        title: '🎰 Kết quả Slots 🎰',
        description: `
            Jackpot: ${Math.floor(botInfo.jackPot)}
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
                jackpot: Math.floor(botInfo.jackPot),
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
    }, 4000);
  }
}
