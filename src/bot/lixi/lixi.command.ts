import {
  ChannelMessage,
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
} from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { getRandomColor } from 'src/bot/utils/helps';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { User } from '../models/user.entity';
import { EUserError } from '../constants/error';
import { EmbedProps, FuncType, MEZON_EMBED_FOOTER } from '../constants/configs';
import { UserCacheService } from 'src/bot/services/user-cache.service';

@Command('lixi')
export class LixiCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userCacheService: UserCacheService,
  ) {
    super(clientService);
  }

  async execute1(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const msgText = `❌ Command Lixi hiện đang bảo trì!`;
    return await messageChannel?.reply({
      t: msgText,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: msgText.length,
        },
      ],
    });
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);

    if (message.username === 'Anonymous') {
      const content = `[Lixi] Anonymous can't use this command!`;

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

    try {
      const findUser = await this.userCacheService.getUserFromCache(
        message.sender_id as string,
      );

      if (!findUser) {
        const newUser = await this.userCacheService.createUserIfNotExists(
          message.sender_id as string,
          message.username,
          message.clan_nick,
        );

        if (!newUser) {
          return await messageChannel?.reply({
            t: EUserError.INVALID_USER,
            mk: [
              {
                type: EMarkdownType.PRE,
                s: 0,
                e: EUserError.INVALID_USER.length,
              },
            ],
          });
        }
      }

      const banStatus = await this.userCacheService.getUserBanStatus(
        message.sender_id as string,
        FuncType.LIXI,
      );

      if (banStatus.isBanned && banStatus.banInfo) {
        const unbanDate = new Date(banStatus.banInfo.unBanTime * 1000);
        const formattedTime = unbanDate.toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour12: false,
        });
        const content = banStatus.banInfo.note;

        const msgText = `❌ Bạn đang bị cấm thực hiện hành động "lixi" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
        return await messageChannel?.reply({
          t: msgText,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: msgText.length,
            },
          ],
        });
      }

      const messageid = message.message_id;

      const onlyLixiSyntax =
        message?.content?.t && typeof message.content.t === 'string'
          ? message.content.t.trim() === '*lixi'
          : false;

      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `[Lixi]`,
          fields: [
            {
              name: 'description:',
              value: '',
              inputs: {
                id: `lixi-${messageid}-description-ip`,
                type: EMessageComponentType.INPUT,
                component: {
                  id: `lixi-${messageid}-description-plhder`,
                  placeholder: 'Ex. Write something',
                  required: true,
                  textarea: true,
                },
              },
            },
            {
              name: 'TotalAmount:',
              value: '',
              inputs: {
                id: `lixi-${messageid}-totalAmount-ip`,
                type: EMessageComponentType.INPUT,
                component: {
                  id: `lixi-${messageid}-totalAmount-plhder`,
                  required: true,
                  defaultValue: 10000,
                  type: 'number',
                },
              },
            },
            {
              name: 'MinLixi:',
              value: '',
              inputs: {
                id: `lixi-${messageid}-minLixi-ip`,
                type: EMessageComponentType.INPUT,
                component: {
                  id: `lixi-${messageid}-minLixi-plhder`,
                  required: true,
                  defaultValue: 10000,
                  type: 'number',
                },
              },
            },
            {
              name: 'NumLixi:',
              value: '',
              inputs: {
                id: `lixi-${messageid}-numLixi`,
                type: EMessageComponentType.INPUT,
                component: {
                  id: `lixi-${messageid}-numLixi-plhder`,
                  required: true,
                  defaultValue: 1,
                  type: 'number',
                },
              },
            },
          ],
          timestamp: new Date().toISOString(),
          footer: MEZON_EMBED_FOOTER,
        },
      ];

      const components = [
        {
          components: [
            {
              id: `lixi_CANCEL_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${0}_${0}_${messageid}`,
              type: EMessageComponentType.BUTTON,
              component: {
                label: `Cancel`,
                style: EButtonMessageStyle.SECONDARY,
              },
            },
            {
              id: `lixi_SUBMITCREATE_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${0}_${0}_${messageid}`,
              type: EMessageComponentType.BUTTON,
              component: {
                label: `Create`,
                style: EButtonMessageStyle.SUCCESS,
              },
            },
          ],
        },
      ];

      if (onlyLixiSyntax) {
        const messLixi = await messageChannel?.reply({
          embed,
          components,
        });
        if (!messLixi) return;

        const dataMezonBotMessage = {
          messageId: messLixi.message_id,
          userId: message.sender_id,
          clanId: message.clan_id,
          isChannelPublic: message.is_public,
          modeMessage: message.mode,
          channelId: message.channel_id,
          createAt: Date.now(),
          lixiResult: [[], 0, []],
        };
        await this.mezonBotMessageRepository.insert(dataMezonBotMessage);
        return;
      }
    } catch (error) {
      console.error('Error in LixiCommand:', error);

      const errorMessage =
        'Có lỗi xảy ra khi xử lý lệnh lixi. Vui lòng thử lại sau.';
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
