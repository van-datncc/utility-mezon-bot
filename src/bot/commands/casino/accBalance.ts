import { ChannelMessage, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { EUserError } from 'src/bot/constants/error';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { UserCacheService } from 'src/bot/services/user-cache.service';

@Command('kttk')
export class AccBalanceCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    private userCacheService: UserCacheService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    try {
      const result = await this.userCacheService.getUserBalance(
        message.sender_id as string,
      );

      if (result.error) {
        return await messageChannel?.reply({
          t:
            result.error === 'User not found'
              ? EUserError.INVALID_USER
              : result.error,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: result.error.length,
            },
          ],
        });
      }

      const successMessage = `💸Số dư của bạn là ${Math.floor(result.balance).toLocaleString('vi-VN')}đ`;

      return await messageChannel?.reply({
        t: successMessage,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: successMessage.length,
          },
        ],
      });
    } catch (error) {
      console.error('Error in AccBalanceCommand:', error);

      const errorMessage =
        'Có lỗi xảy ra khi kiểm tra số dư. Vui lòng thử lại sau.';
      return await messageChannel?.reply({
        t: errorMessage,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: errorMessage.length,
          },
        ],
      });
    }
  }
}
