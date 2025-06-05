import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { UserSicbo } from 'src/bot/models/user.sicbo.entity';
import { getRandomColor } from 'src/bot/utils/helps';

@Command('sicbobet')
export class BetInfoCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(Sicbo)
    private sicboRepository: Repository<Sicbo>,
    @InjectRepository(UserSicbo)
    private userSicboRepository: Repository<UserSicbo>,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });
    if (!findSicbo) {
      const content =
        '...💸Chưa có phòng sicbo nào được mở, hãy *sicbo để mở phòng...';
      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length,
          },
        ],
      });
    }
    const findUserSicbo = await this.userSicboRepository.findOne({
      where: { userId: message.sender_id, sicboId: findSicbo.id.toString() },
    });

    if (!findUserSicbo) {
      const content = `...💸Bạn chưa có đặt cược nào...`;
      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length,
          },
        ],
      });
    }

    const embed = [
      {
        color: getRandomColor(),
        title: `🎲 Sicbo 🎲`,
        fields: [
          {
            name: '💰 Số tiền bet tổng:',
            value: `Tài: ${Number(findSicbo.sic)}\nXỉu: ${Number(findSicbo.bo)}`,
            inline: false,
          },
          {
            name: `💰 Số tiền bet ${message.username}:`,
            value: `Tài: ${Number(findUserSicbo.sic)}\nXỉu: ${Number(findUserSicbo.bo)}`,
            inline: false,
          },
        ],
      },
    ];

    return await messageChannel?.reply({
      embed: embed,
    });
  }
}
