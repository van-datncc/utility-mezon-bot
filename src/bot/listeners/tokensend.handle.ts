import { OnEvent } from '@nestjs/event-emitter';
import { Events, TokenSentEvent } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/bot/models/user.entity';
import { Repository } from 'typeorm';
import { Transaction } from '../models/transaction.entity';
@Injectable()
export class ListenerTokenSend {
  constructor(
      @InjectRepository(User)
      private userRepository: Repository<User>,
      @InjectRepository(Transaction)
      private transactionRepository: Repository<Transaction>,
    ) {}

  @OnEvent(Events.TokenSend)
  async handleRecharge(tokenEvent: TokenSentEvent) {
    if (tokenEvent.amount <= 0) return; 
    if (tokenEvent.receiver_id === process.env.UTILITY_BOT_ID && tokenEvent.sender_id) {
      try {
        const sender = await this.userRepository.findOne({
          where: { user_id: tokenEvent.sender_id },
        });

        if (!sender) return;
        sender.amount = (Number(sender.amount) || 0) + Number(tokenEvent.amount);
        await this.userRepository.save(sender);
        const transaction = {
          transactionId: tokenEvent.transaction_id,
          sender_id: tokenEvent.sender_id,
          receiver_id: tokenEvent.receiver_id,
          amount: tokenEvent.amount,
          note: tokenEvent.note,
          createAt: Date.now()
        }
        await this.transactionRepository.insert(transaction)
      } catch (e) {
        console.log(e);
      }
    }
  }


}
