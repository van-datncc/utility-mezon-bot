import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BlockRut } from 'src/bot/models/blockrut.entity';
import { FuncType } from 'src/bot/constants/configs';

let withdraw: string[] = [];
@Command('rut')
export class WithdrawTokenCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(BlockRut)
    private BlockRutRepository: Repository<BlockRut>,
    private dataSource: DataSource,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    if (!findUser) {
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
    const activeBan = Array.isArray(findUser.ban)
      ? findUser.ban.find(
          (ban) =>
            (ban.type === FuncType.RUT || ban.type === FuncType.ALL) &&
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
      const msgText = `❌ Bạn đang bị cấm thực hiện hành động "rut" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
      return await messageChannel?.reply({
        t: msgText,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: msgText.length,
          },
        ],
      });
    }

    if (!findUser) {
    }
    const blockrut = await this.BlockRutRepository.findOne({
      where: { id: 1 },
    });
    if (blockrut && blockrut.block === true) {
      console.log('blockrut');
      return;
    }
    if (withdraw.includes(message.sender_id)) {
      return;
    }

    withdraw.push(message.sender_id);
    const money = parseInt(args[0], 10);

    if (args[0] === undefined || money <= 0 || isNaN(money)) {
      withdraw = withdraw.filter((id) => id !== message.sender_id);
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

    await this.dataSource
      .transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const findUser = await userRepo.findOne({
          where: { user_id: message.sender_id },
        });

        if (!findUser) {
          throw new Error(EUserError.INVALID_USER);
        }

        if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
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
          mk: [{ type: EMarkdownType.PRE, s: 0, e: successMessage.length }],
        });
      })
      .catch(async (err) => {
        let errorText = EUserError.INVALID_AMOUNT;
        if (err.message === EUserError.INVALID_USER) {
          errorText = EUserError.INVALID_USER;
        }

        await messageChannel?.reply({
          t: errorText,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: errorText.length }],
        });
      })
      .finally(() => {
        withdraw = withdraw.filter((id) => id !== message.sender_id);
      });
  }
}
