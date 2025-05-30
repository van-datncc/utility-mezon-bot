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
    console.log('args: ', args[0]);
    const messageChannel = await this.getChannelMessage(message);

    if (message.username === 'Anonymous') {
      const content =
        '```' + `[mybuyorder] Anonymous can't use this command!` + '```';

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
    const findTransaction = await this.transactionRepository.findOne({
      where: { transactionId: args[0] },
    });
    if (!findTransaction) {
      const channel = await this.client.channels.fetch(message.channel_id);
      const user = await channel.clan.users.fetch(message.sender_id);
      const transaction = await user.listTransactionDetail(args[0]);
      const findTransaction = await this.transactionRepository.findOne({
        where: {},
        order: { id: 'ASC' },
      });
      if (findTransaction?.createAt && new Date(transaction.create_time).getTime() < findTransaction.createAt) {
        
        const content =
          '```' +
          `[Transaction] transaction này đã tồn tại
        ` +
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
                type: EMarkdownType.TRIPLE,
                s: 0,
                e: EUserError.INVALID_USER.length,
              },
            ],
          });
        }
        findUser.amount = Number(findUser.amount) + Number(transaction.amount);
        await this.userRepository.save(findUser);

        const content =
          '```' +
          `[Transaction] Đã cập nhật lại token
        ` +
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

      const content =
        '```' +
        `[Transaction] transaction không hợp lệ
        ` +
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

    const content =
      '```' +
      `[Transaction] transaction này đã tồn tại
        ` +
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
  return;
}
