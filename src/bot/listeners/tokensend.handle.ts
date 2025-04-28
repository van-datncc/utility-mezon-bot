import { OnEvent } from '@nestjs/event-emitter';
import { Events, TokenSentEvent } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/bot/models/user.entity';
import { Repository } from 'typeorm';
@Injectable()
export class ListenerTokenSend {
  constructor(
      @InjectRepository(User)
      private userRepository: Repository<User>,
    ) {}

  @OnEvent(Events.TokenSend)
  async handleRecharge(tokenEvent: TokenSentEvent) {
    console.log('tokenEvent: ', tokenEvent);
    console.log('process.env.BOT_KOMU_ID: ', process.env.BOT_KOMU_ID);
    if (tokenEvent.amount <= 0) return; 
    if (tokenEvent.receiver_id === process.env.BOT_KOMU_ID && tokenEvent.sender_id) {
      try {
        const sender = await this.userRepository.findOne({
          where: { user_id: tokenEvent.sender_id },
        });
        console.log('sender1: ', sender);

        if (!sender) return;
        sender.amount = (Number(sender.amount) || 0) + Number(tokenEvent.amount);
        console.log('sender2: ', sender);
        await this.userRepository.save(sender);
      } catch (e) {
        console.log(e);
      }
    }
  }


}
