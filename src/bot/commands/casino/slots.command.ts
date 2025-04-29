import { InjectRepository } from '@nestjs/typeorm';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Repository } from 'typeorm';
import { getRandomColor } from 'src/bot/utils/helps';
import { EUserError } from 'src/bot/constants/error';

const slotItems = ['🍇', '🍉', '🍊', '🍎', '🍓', '🍒'];

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

    if (!args[0]) {
      return messageChannel?.reply({
        t: 'Bạn cần cung cấp số tiền cược.',
        mk: [],
      });
    }

    const money = parseInt(args[0], 10);

    if (isNaN(money) || money <= 0) {
      return messageChannel?.reply({
        t: 'Số tiền cược phải là một số dương hợp lệ.',
        mk: [],
      });
    }

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

    if ((findUser.amount || 0) < money) {
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
    for (let i = 0; i < 3; i++) {
      number[i] = Math.floor(Math.random() * slotItems.length);
    }

    let multiplier = 0;

    if (number[0] === number[1] && number[1] === number[2]) {
      multiplier = 9;
      win = true;
    } else if (
      number[0] === number[1] ||
      number[0] === number[2] ||
      number[1] === number[2]
    ) {
      multiplier = 2;
      win = true;
    }

    const wonAmount = money * multiplier;
    findUser.amount = win
      ? Number(findUser.amount) + Number(wonAmount)
      : Number(findUser.amount) - Number(money);
    await this.userRepository.save(findUser);

    const resultEmbed = {
      color: getRandomColor(),
      title: '🎰 Kết quả Slots 🎰',
      description: `
            ${slotItems[number[0]]} | ${slotItems[number[1]]} | ${slotItems[number[2]]}
            Bạn đã cược: ${money}
            Bạn ${win ? 'thắng' : 'thua'}: ${win ? wonAmount : money}
            `,
      fields: [
        { name: `kq1`, value: `  ${slotItems[number[0]]}` },
        {
          name: `kq2`,
          value: `  ${slotItems[number[1]]}`,
        },
        {
          name: `kq3`,
          value: `  ${slotItems[number[2]]}`,
        },
      ],
    };

    return messageChannel?.reply({ embed: [resultEmbed] });
  }
}
