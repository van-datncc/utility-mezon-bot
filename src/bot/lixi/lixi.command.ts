import {
  ChannelMessage,
  EMarkdownType,
} from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { getRandomColor } from 'src/bot/utils/helps';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { LixiService } from './lixi.service';
import { User } from '../models/user.entity';
import { EUserError } from '../constants/error';

@Command('lixi')
export class LixiCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private lixiService: LixiService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const raw = args.join(' ');
    const regex = /\[(.+?)\]:([^\s]+)/g;

    const parsedArgs: Record<string, string> = {};
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
      const key = match[1];
      const value = match[2].match(/^\d+/)?.[0] || '';
      parsedArgs[key] = value;
    }

    const totalAmount = parseInt(parsedArgs['totalAmount'], 10);
    const minLixi = parseInt(parsedArgs['minLixi'], 10);
    const numLixi = parseInt(parsedArgs['numLixi'], 10);

    if (
      isNaN(totalAmount) ||
      totalAmount % 10000 !== 0 ||
      isNaN(minLixi) ||
      minLixi % 10000 !== 0 ||
      isNaN(numLixi) ||
      numLixi <= 0
    ) {
      const content =
        '```' +
        `[Lixi]
        - Vui lòng nhập đúng định dạng:
          [totalAmount]:100000 [minLixi]:10000 [numLixi]:10
        - totalAmount và minLixi phải bội số của 10000
        - numLixi phải là số nguyên dương` +
        '```';

      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: content.length + 6,
          },
        ],
      });
    }

    let balance = totalAmount - numLixi * minLixi;
    if (balance < 0) {
      const content =
        '```' +
        `[Lixi]
        [totalAmount] < [minLixi] * [numLixi]` +
        '```';
      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: content.length + 6,
          },
        ],
      });
    }
    
    let result = Array(numLixi).fill(minLixi);

    let diff = totalAmount - result.reduce((a, b) => a + b, 0);
    while (diff >= 10000) {
      const i = Math.floor(Math.random() * result.length);
      result[i] += 10000;
      diff -= 10000;
    }
    const resultEmbed = {
      color: getRandomColor(),
      title: 'Lixi',
      description: `Tổng: ${totalAmount.toLocaleString()}đ
            Số lượng lixi: 0/${numLixi}
            `,
    };
    const colorEmbed = getRandomColor();
    const lixiDetail = {
      totalAmount: totalAmount,
      numLixi: numLixi,
    };
    const components = this.lixiService.generateButtonComponents(
      {
        ...message,
        color: colorEmbed,
      },
      lixiDetail,
    );

    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    if (!findUser)
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

    if ((findUser.amount || 0) < totalAmount || isNaN(findUser.amount)) {
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
    findUser.amount = Number(findUser.amount) - Number(totalAmount);
    await this.userRepository.save(findUser);

    const messLixi = await messageChannel?.reply({
      embed: [resultEmbed],
      components,
    });
    if (!messLixi) return;
    const dataMezonBotMessage = {
      messageId: messLixi.message_id,
      userId: message.sender_id,
      clanId: message.clan_id,
      isChannelPublic: message.is_public,
      modeMessage: message.mode,
      channelId: message.channel_id,
      content: `${totalAmount} + '_' + ${minLixi} + '_' + ${numLixi}`,
      createAt: Date.now(),
      lixiResult: [result, totalAmount, []],
    };
    await this.mezonBotMessageRepository.insert(dataMezonBotMessage);

    return;
  }
}
