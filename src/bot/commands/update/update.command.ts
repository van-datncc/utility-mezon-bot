import { InjectRepository } from '@nestjs/typeorm';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Repository } from 'typeorm';

@Command('update')
export class UpdateCommand extends CommandMessage {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    clientService: MezonClientService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    if (message.sender_id !== '1827994776956309504') return;
    const messageChannel = await this.getChannelMessage(message);
    if (args[0] === 'up') {
      const userId = args[1];
      const findUser = await this.userRepository.findOne({
        where: { user_id: userId },
      });
      if (!findUser || userId === process.env.UTILITY_BOT_ID) {
        return messageChannel?.reply({ t: 'Not found user!' });
      }
      const userAmount = +findUser.amount;
      const isNumber = !isNaN(Number(args[2]));
      if (!isNumber) {
        return messageChannel?.reply({ t: 'Amount invalid!' });
      }
      const amount = +userAmount + Number(args[2]);
      await this.userRepository.update({ user_id: userId }, { amount });
      return messageChannel?.reply({
        t: `Cộng ${args[2]} cho user ${userId} thành công!`,
      });
    }

    if (args[0] === 'down') {
      const userId = args[1];
      const findUser = await this.userRepository.findOne({
        where: { user_id: userId },
      });
      if (!findUser || userId === process.env.UTILITY_BOT_ID) {
        return messageChannel?.reply({ t: 'Not found user!' });
      }
      const userAmount = +findUser.amount;
      const isNumber = !isNaN(Number(args[2]));
      if (!isNumber) {
        return messageChannel?.reply({ t: 'Amount invalid!' });
      }
      const amount = +userAmount - Number(args[2]);
      await this.userRepository.update({ user_id: userId }, { amount });
      return messageChannel?.reply({
        t: `Trừ ${args[2]} cho user ${userId} thành công!`,
      });
    }

    if (args[0] === 'jackPotUp') {
      const userId = process.env.UTILITY_BOT_ID;
      const findUser = await this.userRepository.findOne({
        where: { user_id: userId },
      });
      if (!findUser) {
        return messageChannel?.reply({ t: 'Not found user!' });
      }
      const jackPot = +findUser.jackPot;
      const isNumber = !isNaN(Number(args[1]));
      if (!isNumber) {
        return messageChannel?.reply({ t: 'Amount invalid!' });
      }
      const jackPotUp = +jackPot + Number(args[1]);
      await this.userRepository.update(
        { user_id: userId },
        { jackPot: jackPotUp },
      );
      return messageChannel?.reply({
        t: `Tăng thêm jackpot ${args[1]} thành công!`,
      });
    }

    if (args[0] === 'jackPotDown') {
      const userId = process.env.UTILITY_BOT_ID;
      const findUser = await this.userRepository.findOne({
        where: { user_id: userId },
      });
      if (!findUser) {
        return messageChannel?.reply({ t: 'Not found user!' });
      }
      const jackPot = +findUser.jackPot;
      const isNumber = !isNaN(Number(args[1]));
      if (!isNumber) {
        return messageChannel?.reply({ t: 'Amount invalid!' });
      }
      const jackPotUp = +jackPot - Number(args[1]);
      await this.userRepository.update(
        { user_id: userId },
        { jackPot: jackPotUp },
      );
      return messageChannel?.reply({
        t: `Giảm jackpot đi ${args[1]} thành công!`,
      });
    }

    return messageChannel?.reply({ t: 'up, down, jackPotUp, jackPotDown' });
  }
}
