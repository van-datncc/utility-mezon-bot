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
  private queue: ChannelMessage[] = [];
  private running = false;
  constructor(
    clientService: MezonClientService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(clientService);
    this.startWorker();
  }

  private async startWorker() {
    if (this.running) return;
    this.running = true;
    setInterval(async () => {
      if (this.queue.length === 0) return;
      const msg = this.queue.shift();
      if (msg) await this.processCheckTransaction(msg);
    }, 100);
  }

  async getTotalAmountUser() {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('SUM(user.amount)', 'total_amount')
      .where('user.amount > 0')
      .getRawOne();

    const totalAmount = result.total_amount;
    return totalAmount;
  }

  async execute(args: string[], message: ChannelMessage) {
    (message as any).args = args;
    if (args[0] === 'admin') {
      if (message.sender_id !== '1827994776956309504') return;
      const messageChannel = await this.getChannelMessage(message);
      const totalAmount = await this.getTotalAmountUser();
      const findBot = await this.userRepository.findOne({
        where: { user_id: process.env.UTILITY_BOT_ID },
      });
      await messageChannel?.reply({
        t: `Tổng tiền user: ${totalAmount - (findBot?.amount ?? 0)}, Tiền POT: ${findBot?.jackPot ?? 0}, , Tiền user + pot: ${totalAmount - (findBot?.amount ?? 0) + (findBot?.jackPot ?? 0)} \n , Tiền bot: ${findBot?.amount ?? ''}`,
      });
      return;
    }
    this.queue.push(message);
  }

  async processCheckTransaction(message: ChannelMessage) {
    const args = (message as any).args;
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
        const users = await this.userRepository.find({
          where: [
            { user_id: message.sender_id },
            { user_id: process.env.UTILITY_BOT_ID },
          ],
        });
        const findUser = users.find(
          (user) => user.user_id === message.sender_id,
        );

        const botInfo = users.find(
          (user) => user.user_id === process.env.UTILITY_BOT_ID,
        );

        if (!findUser || !botInfo) {
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
        const newUserAmount =
          Number(findUser.amount) + Number(transaction.amount);
        const newBotAmount =
          Number(botInfo.amount) + Number(transaction.amount);
        await Promise.all([
          this.userRepository.update(
            { user_id: message.sender_id },
            { amount: newUserAmount },
          ),
          this.userRepository.update(
            { user_id: process.env.UTILITY_BOT_ID },
            { amount: newBotAmount },
          ),
        ]);

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
