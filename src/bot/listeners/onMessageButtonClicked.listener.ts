import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'mezon-sdk';
import { Injectable } from '@nestjs/common';
import { PollService } from '../commands/poll/poll.service';
import { RoleService } from '../commands/selfAssignableRoles/role.service';
import { LixiService } from '../lixi/lixi.service';
import { SicboService } from '../commands/sicbo/sicbo.service';

@Injectable()
export class ListenerMessageButtonClicked {
  constructor(
    private pollService: PollService,
    private roleService: RoleService,
    private lixiService: LixiService,
    private sicboService: SicboService,
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
          case 'lixi':
          this.handleSelectLixi(data);
          case 'sicbo':
          this.handleSelectBet(data);
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

  async handleSelectLixi(data) {
    try {
      await this.lixiService.handleSelectLixi(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }

  async handleSelectBet(data) {
    try {
      await this.sicboService.handleSelectBet(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }
}
