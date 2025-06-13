import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandStorage } from '../base/storage';
import { CommandMessage } from './command.abstract';
import { extractMessage } from '../utils/helps';
import { CommandBaseInterface } from './interfaces/asterisk.interface';
import { generateSuggestionMessage } from '../utils/suggest';

@Injectable()
export class CommandBase implements CommandBaseInterface {
  public commandList: { [key: string]: CommandMessage };

  constructor(private readonly moduleRef: ModuleRef) {}

  execute(
    messageContent: string,
    message: ChannelMessage,
    commandName?: string,
  ): null[] {
    const [extractedCommandName, args] = extractMessage(messageContent);
    const cmdName = commandName || extractedCommandName;

    const target = CommandStorage.getCommand(cmdName as string);

    if (target) {
      const command = this.moduleRef.get(target);

      if (command) {
        command.execute(args, message);
        return [null];
      }
    } else if (cmdName) {
      const suggestionMessage = generateSuggestionMessage(cmdName as string);

      try {
        const suggestCommand = CommandStorage.getCommand('suggest');
        if (suggestCommand) {
          const command = this.moduleRef.get(suggestCommand);
          if (command) {
            command.execute([], message, suggestionMessage);
          }
        }
      } catch (error) {
        console.error('Error sending suggestion message:', error);
      }
    }

    return [null];
  }
}
