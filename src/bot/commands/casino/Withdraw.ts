import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private dataSource: DataSource,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    if (withdraw.includes(message.sender_id)) {
      return;
    }

    withdraw.push(message.sender_id);
    const messageChannel = await this.getChannelMessage(message);
    const money = parseInt(args[0], 10);

    if (args[0] === undefined || money <= 0 || isNaN(money)) {
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

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const findUser = await userRepo.findOne({
        where: { user_id: message.sender_id },
      });

      if (!findUser) {
        throw new Error(EUserError.INVALID_USER);
      }

      if ((findUser.amount || 0) < money) {
        throw new Error(EUserError.INVALID_AMOUNT);
      }

      findUser.amount = (findUser.amount || 0) - money;
      await userRepo.save(findUser);

      const dataSendToken = {
        sender_id: process.env.UTILITY_BOT_ID,
        sender_name: process.env.BOT_KOMU_NAME,
        receiver_id: message.sender_id,
        amount: money,
      };
      await this.client.sendToken(dataSendToken);

      const successMessage = `...💸Rút ${money} token thành công...`;
      await messageChannel?.reply({
        t: successMessage,
        mk: [{ type: EMarkdownType.TRIPLE, s: 0, e: successMessage.length }],
      });
    }).catch(async (err) => {
      let errorText = EUserError.INVALID_AMOUNT;
      if (err.message === EUserError.INVALID_USER) {
        errorText = EUserError.INVALID_USER;
      }

      await messageChannel?.reply({
        t: errorText,
        mk: [{ type: EMarkdownType.TRIPLE, s: 0, e: errorText.length }],
      });
    }).finally(() => {
      withdraw = withdraw.filter(id => id !== message.sender_id);
    });
  }
}
