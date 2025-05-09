import { OnEvent } from '@nestjs/event-emitter';
import { ChannelMessage, Events } from 'mezon-sdk';
import { CommandBase } from '../base/command.handle';
import { Injectable } from '@nestjs/common';
import { PollService } from '../commands/poll/poll.service';
import { RoleService } from '../commands/selfAssignableRoles/role.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../models/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ListenerMessageButtonClicked {
  constructor(
    private pollService: PollService,
    private roleService: RoleService,
  ) {}

  @OnEvent(Events.MessageButtonClicked)
  async hanndleButtonForm(data) {
    try {
      const args = data.button_id.split('_');
      const buttonConfirmType = args[0];
      switch (buttonConfirmType) {
        case 'poll':
          this.handleSelectPoll(data);
          case 'role':
          this.handleSelectRole(data);
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

  async handleSelectRole(data) {
    try {
      await this.roleService.handleSelectRole(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }
}
