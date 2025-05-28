import { InjectRepository } from '@nestjs/typeorm';
import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Repository } from 'typeorm';
import { getRandomColor } from 'src/bot/utils/helps';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { SicboService } from './sicbo.service';
import { FuncType } from 'src/bot/constants/configs';
import { EUserError } from 'src/bot/constants/error';
import { User } from 'src/bot/models/user.entity';

@Command('sicbo')
export class SicboCommand extends CommandMessage {
  constructor(
    @InjectRepository(Sicbo)
    private sicboRepository: Repository<Sicbo>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    clientService: MezonClientService,
    private sicboService: SicboService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });
    if (!findUser) {
      return await messageChannel?.reply({
        t: EUserError.INVALID_USER,
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: EUserError.INVALID_USER.length,
          },
        ],
      });
    }
    const activeBan = Array.isArray(findUser.ban)
      ? findUser.ban.find(
          (ban) =>
            (ban.type === FuncType.SICBO || ban.type === FuncType.ALL) &&
            ban.unBanTime > Math.floor(Date.now() / 1000),
        )
      : null;

    if (activeBan) {
      const unbanDate = new Date(activeBan.unBanTime * 1000);
      const formattedTime = unbanDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      });
      const content = activeBan.note
      const msgText = `❌ Bạn đang bị cấm thực hiện hành động "sicbo" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
      return await messageChannel?.reply({
        t: '```' + msgText + '```',
        mk: [
          {
            type: EMarkdownType.TRIPLE,
            s: 0,
            e: ('```' + msgText + '```').length,
          },
        ],
      });
    }
    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });
    let endAt = 0;
    let sicboId = findSicbo?.id;
    if (!findSicbo) {
      const dataSicbo = {
        channelId: [message.channel_id],
        createAt: Date.now(),
        // endAt: Date.now() + 3600000,
        endAt: Date.now() + 180000,
      };
      const newSicbo = await this.sicboRepository.save(dataSicbo);
      sicboId = newSicbo.id;
      endAt = Number(Date.now() + 180000);
    } else {
      if (!findSicbo.channelId.includes(message.channel_id)) {
        findSicbo.channelId.push(message.channel_id);
        await this.sicboRepository.save(findSicbo);
      }
      endAt = Number(findSicbo.endAt);
    }
    const results: string[][] = this.sicboService.generateResultsDefault();

    const dataMsg = {
      sender_id: message.sender_id,
      clan_id: message.clan_id,
      mode: message.mode,
      is_public: message.is_public,
      color: getRandomColor(),
      clan_nick: message.clan_nick,
      username: message.username,
    };
    const components = this.sicboService.generateButtonComponents(dataMsg);

    const resultEmbed = this.sicboService.generateEmbedMessage(
      findSicbo?.sic || 0,
      findSicbo?.bo || 0,
      results,
      Number(endAt),
    );

    const messBot = await messageChannel?.reply({
      embed: resultEmbed,
      components,
    });
    if (!messBot) {
      return;
    }
    const sicbo = await this.sicboRepository.findOneBy({ id: sicboId });
    if (!sicbo) {
      return;
    }
    sicbo.message = [
      ...(sicbo.message || []),
      {
        id: messBot.message_id,
        clan_id: message.clan_id || '',
        channel_id: message.channel_id,
      },
    ];
    await this.sicboRepository.save(sicbo);
    return;
  }
}
