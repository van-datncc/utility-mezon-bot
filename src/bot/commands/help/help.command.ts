import { ChannelMessage, EMarkdownType, MezonClient } from 'mezon-sdk';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { CommandStorage } from 'src/bot/base/storage';
import { DynamicCommandService } from 'src/bot/services/dynamic.service';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';

@Command('help')
export class HelpCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    private dynamicCommandService: DynamicCommandService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    const allCommands = CommandStorage.getAllCommands();
    const allCommandsCustom =
      this.dynamicCommandService.getDynamicCommandList();
    const hidenCommandList = [
      'holiday',
      'register',
      'toggleactive',
      'checkchannel',
      'toggleprivatechannel',
      'togglechannel',
    ];
    const allCommandKeys = Array.from(allCommands.keys()).filter(
      (item) => !hidenCommandList.includes(item),
    );
    const messageContent =
      'KOMU - Help Menu' +
      '\n' +
      '• KOMU (' +
      allCommandKeys.length +
      ')' +
      '\n' +
      allCommandKeys.join(', ') +
      '\n• Custom Command (' +
      allCommandsCustom.length +
      ')' +
      '\n' +
      allCommandsCustom.join(', ');

    const messageSent = await messageChannel?.reply({
      t: messageContent,
      mk: [{ type: EMarkdownType.PRE, s: 0, e: messageContent.length }],
    });
    return messageSent;
  }
}
