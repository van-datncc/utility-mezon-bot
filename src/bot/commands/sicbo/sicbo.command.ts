import { InjectRepository } from '@nestjs/typeorm';
import {
  ChannelMessage,
} from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Repository } from 'typeorm';
import { getRandomColor } from 'src/bot/utils/helps';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { SicboService } from './sicbo.service';

@Command('sicbo')
export class SicboCommand extends CommandMessage {
  constructor(
    @InjectRepository(Sicbo)
    private sicboRepository: Repository<Sicbo>,
    clientService: MezonClientService,
    private sicboService: SicboService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });
    let endAt = 0
    if (!findSicbo) {
      const dataSicbo = {
        channelId: [message.channel_id],
        createAt: Date.now(),
        // endAt: Date.now() + 3600000,
        endAt: Date.now() + 180000,
      };
      await this.sicboRepository.insert(dataSicbo);
      endAt = Number(Date.now() + 180000)
    } else {
      if (!findSicbo.channelId.includes(message.channel_id)) {
        findSicbo.channelId.push(message.channel_id);
        await this.sicboRepository.save(findSicbo);
      }
      endAt = Number(findSicbo.endAt)
    }
    const results: string[][] = this.sicboService.generateResultsDefault()

    const dataMsg = {
      sender_id: message.sender_id,
      clan_id: message.clan_id,
      mode: message.mode,
      is_public: message.is_public,
      color: getRandomColor(),
      clan_nick: message.clan_nick,
      username: message.username
    } 
    const components = this.sicboService.generateButtonComponents(dataMsg)
    
    const resultEmbed = this.sicboService.generateEmbedMessage(findSicbo?.sic || 0, findSicbo?.bo || 0, results, Number(endAt))
    
    const messBot = await messageChannel?.reply({
      embed: resultEmbed,
      components,
    });
    if (!messBot) {
      return;
    }
    return;
  }
}
