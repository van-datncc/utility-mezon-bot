import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Transaction } from 'src/bot/models/transaction.entity';
import { User } from 'src/bot/models/user.entity';
import { EUserError } from 'src/bot/constants/error';

@Command('chk')
export class ChecktransactionCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    if (message.username === 'Anonymous' || !args[0]) {
      const content = !args[0]
        ? 'Thiếu transactionId!'
        : `[chk] Anonymous can't use this command!`;

      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length,
          },
        ],
      });
    }
    const findTransaction = await this.transactionRepository.findOne({
      where: { transactionId: args[0] },
    });
    if (!findTransaction) {
      const channel = await this.client.channels.fetch(message.channel_id);
      const user = await channel.clan.users.fetch(message.sender_id);
      let transaction;
      try {
        transaction = await user.listTransactionDetail(args[0]);
      } catch (error) {
        const content = `Lỗi khi check transaction!`;

      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length,
          },
        ],
      });
      }
      const cutoffDate = new Date('2025-06-06T00:00:00.000Z'); // sau ngày 07/06/2025 thì return
      console.log('transaction', transaction)
      const createdAt = new Date(transaction?.create_time);
      if (!transaction || createdAt < cutoffDate) {
        const content = `[Transaction] transaction không tồn tại hoặc quá ngày kiểm tra`;
        return await messageChannel?.reply({
          t: content,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: content.length,
            },
          ],
        });
      }
      if (
        transaction.sender_id === message.sender_id &&
        transaction.receiver_id === process.env.UTILITY_BOT_ID
      ) {
        const trans = {
          transactionId: transaction.trans_id,
          sender_id: transaction.sender_id,
          receiver_id: transaction.receiver_id,
          amount: transaction.amount,
          note: transaction.metadata,
          createAt: new Date(transaction.create_time).getTime(),
        };
        await this.transactionRepository.insert(trans);

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
        const newUserAmount = Number(findUser.amount) + Number(transaction.amount);
        await this.userRepository.update({user_id: message.sender_id}, {amount: newUserAmount});

        const content = `[Transaction] Đã cập nhật lại token`;
        return await messageChannel?.reply({
          t: content,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: content.length,
            },
          ],
        });
      }

      const content = `[Transaction] transaction không hợp lệ`;
      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length,
          },
        ],
      });
    }

    const content = `[Transaction] transaction này đã tồn tại`;
    return await messageChannel?.reply({
      t: content,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: content.length,
        },
      ],
    });
  }
  return;
}
