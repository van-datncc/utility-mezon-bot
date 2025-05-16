import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';

let withdraw: string[] = []
@Command('rut')
export class WithdrawTokenCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    if (withdraw.includes(message.sender_id)) {
      return;
    }
    withdraw.push(message.sender_id)
    const messageChannel = await this.getChannelMessage(message);
    const money = parseInt(args[0], 10);
    if (args[0] === undefined || money <= 0) {
      withdraw = withdraw.filter(id => id !== message.sender_id);
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

    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    if (!findUser) {
      withdraw = withdraw.filter(id => id !== message.sender_id);
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
    }

    if ((findUser.amount || 0) < money) {
      withdraw = withdraw.filter(id => id !== message.sender_id);
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

    findUser.amount = (findUser.amount || 0) - money;
    await this.userRepository.save(findUser);
    const successMessage = `...💸Rút ${money} token thành công...`;
    try {
      const dataSendToken = {
        sender_id: process.env.UTILITY_BOT_ID,
        sender_name: process.env.BOT_KOMU_NAME,
        receiver_id: message.sender_id,
        amount: +money,
      };
      await this.client.sendToken(dataSendToken);
      await messageChannel?.reply({
        t: successMessage,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: successMessage.length,
          },
        ],
      });
      withdraw = withdraw.filter(id => id !== message.sender_id);
    } catch (error) {
      findUser.amount = (findUser.amount || 0) + money;
      await this.userRepository.save(findUser);
      withdraw = withdraw.filter(id => id !== message.sender_id);
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
  }
}
