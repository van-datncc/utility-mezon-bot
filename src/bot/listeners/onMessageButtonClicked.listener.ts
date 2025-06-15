import { OnEvent } from '@nestjs/event-emitter';
import { Events } from 'mezon-sdk';
import { Injectable } from '@nestjs/common';
import { PollService } from '../commands/poll/poll.service';
import { RoleService } from '../commands/selfAssignableRoles/role.service';
import { LixiService } from '../lixi/lixi.service';
import { SicboService } from '../commands/sicbo/sicbo.service';
import { BuyService } from '../commands/transactionP2P/buy.service';
import { SellService } from '../commands/transactionP2P/sell.service';

@Injectable()
export class ListenerMessageButtonClicked {
  constructor(
    private pollService: PollService,
    private roleService: RoleService,
    private lixiService: LixiService,
    private sicboService: SicboService,
    private buyService: BuyService,
    private sellService: SellService,
  ) {}

  @OnEvent(Events.MessageButtonClicked)
  async hanndleButtonForm(data) {
    try {
      const args = data.button_id.split('_');
      const buttonConfirmType = args[0];
      switch (buttonConfirmType) {
        case 'poll':
          this.handleSelectPoll(data);
          break;
        case 'role':
          this.handleSelectRole(data);
          break;
        case 'lixi':
          this.handleSelectLixi(data);
          break;
        case 'sicbo':
          this.handleSelectBet(data);
          break;
        case 'buy':
          this.handleSelectBuy(data);
          break;
        case 'confirmBuy':
          this.handleSelectConfirmBuy(data);
          break;
        case 'sell':
          this.handleSelectSell(data);
          break;
        case 'confirmSell':
          this.handleSelectConfirmSell(data);
          break;
        case 'buyerConfirm':
          this.handleBuyerConfirm(data);
          break;
        case 'sellerConfirm':
          this.handleSellerConfirm(data);
          break;
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

  async handleSelectBuy(data) {
    try {
      await this.buyService.handleSelectBuy(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }

  async handleSelectConfirmBuy(data) {
    try {
      await this.buyService.handleSelectConfirmBuy(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }

  async handleSelectSell(data) {
    try {
      await this.sellService.handleSelectSell(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }

  async handleSelectConfirmSell(data) {
    try {
      await this.sellService.handleSelectConfirmSell(data);
    } catch (error) {
      console.log('ERORR handleSelectPoll', error);
    }
  }

  async handleBuyerConfirm(data) {
    try {
      await this.sellService.handleBuyerConfirm(data);
    } catch (error) {
      console.log('ERROR handleBuyerConfirm', error);
    }
  }

  async handleSellerConfirm(data) {
    try {
      await this.buyService.handleSellerConfirm(data);
    } catch (error) {
      console.log('ERROR handleSellerConfirm', error);
    }
  }
}
