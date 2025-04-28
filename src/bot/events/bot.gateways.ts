import { Injectable, Logger } from '@nestjs/common';
import {
  ApiMessageReaction,
  MezonClient,
  Events,
  TokenSentEvent,
  StreamingJoinedEvent,
  StreamingLeavedEvent,
  UserChannelRemoved,
  GiveCoffeeEvent,
  AddClanUserEvent,
} from 'mezon-sdk';

import {
  ChannelCreatedEvent,
  ChannelDeletedEvent,
  ChannelUpdatedEvent,
  UserChannelAddedEvent,
  UserClanRemovedEvent,
} from 'mezon-sdk';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleAssignedEvent } from 'mezon-sdk/dist/cjs/rtapi/realtime';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { ExtendersService } from '../services/extenders.services';

@Injectable()
export class BotGateway {
  private readonly logger = new Logger(BotGateway.name);
  private client: MezonClient;

  constructor(
    private clientService: MezonClientService,
    private extendersService: ExtendersService,
    private eventEmitter: EventEmitter2,
  ) {
    this.client = this.clientService.getClient();
  }

  initEvent() {
    this.client.onWebrtcSignalingFwd((data) => {
      console.log('handlewebrtcsignalingfwd', data);
    });

    this.client.onTokenSend((data: TokenSentEvent) => {
      console.log('TokenSentEvent: ', data);
      this.eventEmitter.emit(Events.TokenSend, data);
    });

    this.client.onMessageButtonClicked((data) => {
      this.eventEmitter.emit(Events.MessageButtonClicked, data);
    });

    this.client.onStreamingJoinedEvent((data: StreamingJoinedEvent) => {
      this.eventEmitter.emit(Events.StreamingJoinedEvent, data);
    });

    this.client.onStreamingLeavedEvent((data: StreamingLeavedEvent) => {
      this.eventEmitter.emit(Events.StreamingLeavedEvent, data);
    });

    this.client.onClanEventCreated((data) => {
      this.eventEmitter.emit(Events.ClanEventCreated, data);
    });

    this.client.onMessageReaction((msg: ApiMessageReaction) => {
      this.eventEmitter.emit(Events.MessageReaction, msg);
    });

    this.client.onChannelCreated((channel: ChannelCreatedEvent) => {
      this.eventEmitter.emit(Events.ChannelCreated, channel);
    });

    this.client.onUserClanRemoved((user: UserClanRemovedEvent) => {
      this.eventEmitter.emit(Events.UserClanRemoved, user);
    });

    this.client.onRoleEvent((data) => {
      this.eventEmitter.emit(Events.RoleEvent, data);
    });

    this.client.onRoleAssign((data) => {
      this.eventEmitter.emit(Events.RoleAssign, data);
    });

    this.client.onUserChannelAdded((user: UserChannelAddedEvent) => {
      this.eventEmitter.emit(Events.UserChannelAdded, user);
    });

    this.client.onChannelDeleted((channel: ChannelDeletedEvent) => {
      this.eventEmitter.emit(Events.ChannelDeleted, channel);
    });

    this.client.onChannelUpdated((channel: ChannelUpdatedEvent) => {
      this.eventEmitter.emit(Events.ChannelUpdated, channel);
    });

    this.client.onUserChannelRemoved((msg: UserChannelRemoved) => {
      this.eventEmitter.emit(Events.UserChannelRemoved, msg);
    });

    this.client.onGiveCoffee((data: GiveCoffeeEvent) => {
      this.eventEmitter.emit(Events.GiveCoffee, data);
    });

    this.client.onAddClanUser(async (data: AddClanUserEvent) => {
      this.eventEmitter.emit(Events.AddClanUser, data);
      const user: any = {
        user_id: data.user.user_id,
        username: data.user.username,
        avatar: data.user.avatar,
        display_name: data.user.display_name,
      };
      await this.extendersService.addDBUser(user);
    });

    this.client.onRoleAssign((data: RoleAssignedEvent) => {
      console.log(data);
    });

    this.client.onChannelMessage(async (message) => {
      ['attachments', 'mentions', 'references'].forEach((key) => {
        if (!Array.isArray(message[key])) message[key] = [];
      });
      try {
        if (message.sender_id && message.sender_id !== '0') {
          const user: any = {
            user_id: message.sender_id,
            username: message.username,
            avatar: message.avatar,
            display_name: message.display_name,
            message_id: message.message_id,
            clan_avatar: message.clan_avatar,
            clan_nick: message.clan_nick,
          };
          await this.extendersService.addDBUser(user);
        }
      } catch (e) {
        console.log(e);
      }
      this.eventEmitter.emit(Events.ChannelMessage, message);
    });
  }
}
