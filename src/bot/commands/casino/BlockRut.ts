import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { User } from 'src/bot/models/user.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { BlockRut } from 'src/bot/models/blockrut.entity';

let withdraw: string[] = []
@Command('blockrut')
export class BlockRutCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(BlockRut)
    private BlockRutRepository: Repository<BlockRut>,
    private dataSource: DataSource,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    if (message.sender_id === '1827994776956309504') {
      const blockrut = await this.BlockRutRepository.findOne({
        where: { id: 1 },
      });
      if (!blockrut) {
        const data = {
          block: true,
        };
        await this.BlockRutRepository.insert(data);
      } else {
        if (blockrut.block === true) {
          blockrut.block = false;
          await this.BlockRutRepository.save(blockrut);
        }else{
          blockrut.block = true;
          await this.BlockRutRepository.save(blockrut);
        }
      }
    }
  }
}
