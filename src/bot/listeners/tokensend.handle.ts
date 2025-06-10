import { OnEvent } from '@nestjs/event-emitter';
import { EMarkdownType, Events, MezonClient, TokenSentEvent } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/bot/models/user.entity';
import { Repository } from 'typeorm';
import { Transaction } from '../models/transaction.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
@Injectable()
export class ListenerTokenSend {
  private client: MezonClient;
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private clientService: MezonClientService,
  ) {
    this.client = this.clientService.getClient();
  }

  @OnEvent(Events.TokenSend)
  async handleRecharge(tokenEvent: TokenSentEvent) {
    if (tokenEvent.amount <= 0) return;
    if (
      tokenEvent.receiver_id === process.env.UTILITY_BOT_ID &&
      tokenEvent.sender_id
    ) {
      try {
        const userIds = [tokenEvent.sender_id, process.env.UTILITY_BOT_ID];
        const users = await this.userRepository.find({
          where: userIds.map((id) => ({ user_id: id })),
        });

        const userMap = new Map(users.map((u) => [u.user_id, u]));
        const sender = userMap.get(tokenEvent.sender_id);
        const botInfo = userMap.get(process.env.UTILITY_BOT_ID);

        if (!sender || !botInfo) return;

        const amount = Number(tokenEvent.amount) || 0;
        sender.amount = (Number(sender.amount) || 0) + +amount;
        botInfo.amount = (Number(botInfo.amount) || 0) + +amount;

        await Promise.all([
          this.transactionRepository.insert({
            transactionId: tokenEvent.transaction_id,
            sender_id: tokenEvent.sender_id,
            receiver_id: tokenEvent.receiver_id,
            amount: tokenEvent.amount,
            note: tokenEvent.note,
            createAt: Date.now(),
          }),
          this.userRepository.save([sender, botInfo]),
        ]);
        const clan = this.client.clans.get('0');
        const user = await clan?.users.fetch(tokenEvent.sender_id);
        const successMessage = `💸Nạp ${tokenEvent.amount} token thành công`;
        await user?.sendDM({
          t: successMessage,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: successMessage.length }],
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
}
