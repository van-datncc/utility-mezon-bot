import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable } from '@nestjs/common';
import { PollService } from '../commands/poll/poll.service';

@Injectable()
export class ListenerMessageButtonClicked {
  constructor(private pollService: PollService) {}

  @OnEvent(Events.MessageButtonClicked)
  async hanndleButtonForm(data) {
    console.log('datadatadata', data)
    try {
      const args = data.button_id.split('_');
      const buttonConfirmType = args[0];
      switch (buttonConfirmType) {
        case 'poll':
          this.handleSelectPoll(data);
        default:
          break;
      }
    } catch (error) {
      console.log('hanndleButtonForm ERROR', error);
    }
  }

  async handleSelectPoll(data) {
    try {
      await this.pollService.handleSelectPoll(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }
}
