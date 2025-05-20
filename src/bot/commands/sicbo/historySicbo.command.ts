import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { UserSicbo } from 'src/bot/models/user.sicbo.entity';
import { getRandomColor } from 'src/bot/utils/helps';

@Command('sicbokq')
export class SicboHistoryCommand extends CommandMessage {
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

    const lastSicbos = await this.sicboRepository.find({
      order: { createAt: 'DESC' },
      take: 5,
    });

    let content = '';
    for (const sicbo of lastSicbos) {
      const userBet = await this.userSicboRepository.findOne({
        where: {
          userId: message.sender_id.toString(),
          sicboId: sicbo.id.toString(),
        },
      });
      if (userBet) {
        content += `• Ván ${sicbo.id}⇒ Kết quả: ${Number(sicbo.result) === 1 ? 'xỉu' : Number(sicbo.result) === 2 ? 'tài' : 'chưa có kết quả'} thắng\n Cược Tài: ${Number(userBet.sic)}, Xỉu: ${userBet.bo}, Thắng: ${Number(userBet.result)}\n`;
      } else {
        content += `• Ván ${sicbo.id}⇒ Kết quả: ${Number(sicbo.result) === 1 ? 'xỉu' : Number(sicbo.result) === 2 ? 'tài' : 'chưa có kết quả'} thắng\n`;
      }
    }
    const embed = [
      {
        color: getRandomColor(),
        title: `🎲 Sicbo 🎲`,
        description: content
      },
    ];
    return await messageChannel?.reply({
      embed: embed,
    });
  }
}
