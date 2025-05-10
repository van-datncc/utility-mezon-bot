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

@Module({
  imports: [
    MulterModule.register({
      dest: './files',
    }),
    DiscoveryModule,
    TypeOrmModule.forFeature([User, MezonBotMessage, WelcomeMessage]),
    HttpModule,
  ],
  providers: [
    CommandBase,
    BotGateway,
    ListenerChannelMessage,
    ListenerMessageButtonClicked,
    HelpCommand,
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
  ],
  controllers: [],
})
export class BotModule {}
