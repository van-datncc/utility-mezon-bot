import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';

@Command('suggest')
export class SuggestCommand extends CommandMessage {
  constructor(clientService: MezonClientService) {
    super(clientService);
  }

  async execute(
    args: string[],
    message: ChannelMessage,
    suggestionMessage?: string,
  ) {
    if (!suggestionMessage) return;

    const messageChannel = await this.getChannelMessage(message);
    if (!messageChannel) return;

    await messageChannel.reply({
      t: suggestionMessage,
      mk: [{ type: EMarkdownType.PRE, s: 0, e: suggestionMessage.length }],
    });
  }
}
