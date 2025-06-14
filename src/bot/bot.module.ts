import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { User } from './models/user.entity';
import { ExtendersService } from './services/extenders.services';
import { DynamicCommandService } from './services/dynamic.service';
import { HelpCommand } from './commands/help/help.command';
import { BotGateway } from './events/bot.gateways';
import { ListenerChannelMessage } from './listeners/onChannelMessage.listener';
import { CommandBase } from './base/command.handle';
import { AvatarCommand } from './commands/avatar/avatar.command';
import { PollCommand } from './commands/poll/poll.command';
import { PollService } from './commands/poll/poll.service';
import { MezonBotMessage } from './models/mezonBotMessage.entity';
import { ListenerMessageButtonClicked } from './listeners/onMessageButtonClicked.listener';
import { QRCodeCommand } from './commands/qrcode/qrcode.command';
import { ListenerTokenSend } from './listeners/tokensend.handle';
import { WithdrawTokenCommand } from './commands/casino/Withdraw';
import { AccBalanceCommand } from './commands/casino/accBalance';
import { SlotsCommand } from './commands/casino/slots.command';
import { WelcomeMessageHandler } from './listeners/welcomeMessages';
import { WelcomeMessage } from './models/welcomeMessage.entity';
import { WelcomeMsgCommand } from './commands/welcomeMessages/welcomeMessages.command';
import { WelcomeMsgInfoCommand } from './commands/welcomeMessages/welcomeMessagesInfo.command';
import { RoleCommand } from './commands/selfAssignableRoles/role.command';
import { RoleService } from './commands/selfAssignableRoles/role.service';
import { WhiteListAddCommand } from './commands/selfAssignableRoles/whiteList';
import { LixiCommand } from './lixi/lixi.command';
import { LixiService } from './lixi/lixi.service';
import { SicboCommand } from './commands/sicbo/sicbo.command';
import { UserSicbo } from './models/user.sicbo.entity';
import { Sicbo } from './models/sicbo.entity';
import { SicboSchedulerService } from './commands/sicbo/sicboScheduler.services';
import { SicboService } from './commands/sicbo/sicbo.service';
import { BetInfoCommand } from './commands/sicbo/betinfo.command';
import { BlockRut } from './models/blockrut.entity';
import { BlockRutCommand } from './commands/casino/BlockRut';
import { SicboHistoryCommand } from './commands/sicbo/historySicbo.command';
import { BanCommand } from './commands/ban/ban';
import { PollSchedulerService } from './commands/poll/poll-scheduler.service';
import { TransactionP2P } from './models/transactionP2P.entity';
import { BuyService } from './commands/transactionP2P/buy.service';
import { BuyCommand } from './commands/transactionP2P/buy.command';
import { MyBuyCommand } from './commands/transactionP2P/myListBuy.command';
import { ListBuyCommand } from './commands/transactionP2P/listBuy.command';
import { UnbanCommand } from './commands/ban/unban';
import { SellCommand } from './commands/transactionP2P/sell.command';
import { SellService } from './commands/transactionP2P/sell.service';
import { ListSellCommand } from './commands/transactionP2P/listSell.command';
import { MySellCommand } from './commands/transactionP2P/myListSell.command';
import { Transaction } from './models/transaction.entity';
import { ChecktransactionCommand } from './commands/transaction/checktransaction.command';
import { JackPotTransaction } from './models/jackPotTransaction.entity';
import { UpdateCommand } from './commands/update/update.command';
import { SuggestCommand } from './commands/help/suggest.command';

@Module({
  imports: [
    MulterModule.register({
      dest: './files',
    }),
    DiscoveryModule,
    TypeOrmModule.forFeature([
      User,
      MezonBotMessage,
      WelcomeMessage,
      Sicbo,
      UserSicbo,
      BlockRut,
      TransactionP2P,
      Transaction,
      JackPotTransaction,
    ]),
    HttpModule,
  ],
  providers: [
    CommandBase,
    BotGateway,
    ListenerChannelMessage,
    ListenerMessageButtonClicked,
    HelpCommand,
    SuggestCommand,
    AvatarCommand,
    PollCommand,
    QRCodeCommand,
    PollService,
    ConfigService,
    ExtendersService,
    DynamicCommandService,
    ListenerTokenSend,
    WithdrawTokenCommand,
    AccBalanceCommand,
    SlotsCommand,
    WelcomeMessageHandler,
    WelcomeMsgCommand,
    WelcomeMsgInfoCommand,
    RoleCommand,
    RoleService,
    WhiteListAddCommand,
    LixiCommand,
    LixiService,
    SicboCommand,
    SicboSchedulerService,
    SicboService,
    BetInfoCommand,
    BlockRutCommand,
    SicboHistoryCommand,
    BanCommand,
    PollSchedulerService,
    BuyService,
    BuyCommand,
    MyBuyCommand,
    ListBuyCommand,
    UnbanCommand,
    SellCommand,
    SellService,
    ListSellCommand,
    MySellCommand,
    ChecktransactionCommand,
    UpdateCommand,
  ],
  controllers: [],
})
export class BotModule {}
