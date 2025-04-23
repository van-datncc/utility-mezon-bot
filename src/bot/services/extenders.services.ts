import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../models/user.entity';
import { ChannelMessage } from 'mezon-sdk';

@Injectable()
export class ExtendersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async addDBUser(message: ChannelMessage) {
    if (message.sender_id === '1767478432163172999') return; // ignored anonymous user
    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });

    if (findUser) {
      findUser.user_id = message.sender_id!;
      findUser.username = message.username!;
      findUser.avatar = message.clan_avatar! || message.avatar!;
      findUser.bot = false;
      findUser.display_name = message.display_name ?? '';
      findUser.clan_nick = message.clan_nick
        ? message.clan_nick
        : findUser.clan_nick;
      findUser.last_message_id = message.message_id!;
      findUser.last_message_time = Date.now();
      findUser.deactive = findUser.deactive;
      findUser.botPing = findUser.botPing;
      await this.userRepository.save(findUser);
      return;
    }

    const komuUser = {
      user_id: message.sender_id,
      username: message.username,
      avatar: message.clan_avatar || message.avatar,
      bot: false,
      display_name: message.display_name ?? '',
      clan_nick: message.clan_nick ?? '',
      last_message_id: message.message_id,
      last_message_time: Date.now(),
      scores_quiz: 0,
      deactive: false,
      botPing: false,
      createdAt: Date.now(),
    };

    await this.userRepository.insert(komuUser);
  }
}
