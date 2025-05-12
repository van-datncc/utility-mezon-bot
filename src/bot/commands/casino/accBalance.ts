import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';

@Command('kttk')
export class AccBalanceCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
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

    const successMessage = `...💸Số dư của bạn là ${Math.floor(Number(findUser.amount))}đ...`;

    return await messageChannel?.reply({
      t: successMessage,
      mk: [
        {
          type: EMarkdownType.TRIPLE,
          s: 0,
          e: successMessage.length,
        },
      ],
    });
  }
}
