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
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    clientService: MezonClientService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const money = 5000;

    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    const botInfo = await this.userRepository.findOne({
      where: { user_id: process.env.UTILITY_BOT_ID },
    });

    if (!findUser || !botInfo)
      return await messageChannel?.reply({
        t: EUserError.INVALID_USER,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: EUserError.INVALID_USER.length,
          },
        ],
      });

    if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
      return await messageChannel?.reply({
        t: EUserError.INVALID_AMOUNT,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
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
      (number[0] === number[1] &&
      number[1] === number[2] &&
      slotItems[number[0]] === '1.JPG')
    ) {
      wonAmount = botInfo?.jackPot;
      isJackPot = true;
      win = true;
    } else if (number[0] === number[1] && number[1] === number[2]) {
      wonAmount = botInfo?.jackPot * 0.3;
      win = true;
    } else if (
      number[0] === number[1] ||
      number[0] === number[2] ||
      number[1] === number[2]
    ) {
      wonAmount = money * 0.4;
      if (botInfo?.jackPot < betMoney * 0.4) {
        wonAmount = botInfo?.jackPot;
        isJackPot = true;
      }
      win = true;
    }
    findUser.amount = win
      ? Number(findUser.amount) + Number(wonAmount)
      : Number(findUser.amount) - Number(money);
    await this.userRepository.save(findUser);
    botInfo.jackPot = win
      ? Number(botInfo.jackPot) - Number(wonAmount)
      : Number(botInfo.jackPot) + Number(betMoney);
    botInfo.amount = Number(botInfo.amount) + Number(money - betMoney);

    if (isJackPot) {
      if (botInfo.amount > 100000) {
        botInfo.jackPot = 100000;
        botInfo.amount =
          Number(botInfo.amount) + Number(money - betMoney) - 100000;
      } else {
        botInfo.jackPot = botInfo.amount;
        botInfo.amount = Number(botInfo.amount) - Number(botInfo.jackPot);
      }
    }
    await this.userRepository.save(botInfo);
    const resultEmbed = {
      color: getRandomColor(),
      title: '🎰 Kết quả Slots 🎰',
      fields: [
        {
          name: '',
          value: '',
          inputs: {
            id: `slots`,
            type: 6,
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
    if (!messBot) {
      return;
    }

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
            Jackpot: ${botInfo.jackPot}
            Bạn đã cược: ${money}
            Bạn ${win ? 'thắng' : 'thua'}: ${win ? wonAmount : money}
            `,
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `slots`,
              type: 6,
              component: {
                url_image:
                  'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420411527_0spritesheet.png',
                url_position:
                  'https://cdn.mezon.ai/1840678035754323968/1840682993002221568/1779513150169682000/1746420408191_0spritesheet.json',
                jackpot: botInfo.jackPot,
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
    return;
  }
}
