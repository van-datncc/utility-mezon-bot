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
import {
  EmbedProps,
  FuncType,
  MEZON_EMBED_FOOTER,
} from 'src/bot/constants/configs';
import { User } from 'src/bot/models/user.entity';
import { EUserError } from 'src/bot/constants/error';

@Command('buy')
export class BuyCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
            type: EMarkdownType.PRE,
            s: 0,
            e: EUserError.INVALID_USER.length,
          },
        ],
      });
    }
    const activeBan = Array.isArray(findUser.ban)
      ? findUser.ban.find(
          (ban) =>
            (ban.type === FuncType.TRANSACTION || ban.type === FuncType.ALL) &&
            ban.unBanTime > Math.floor(Date.now() / 1000),
        )
      : null;

    if (activeBan) {
      const unbanDate = new Date(activeBan.unBanTime * 1000);
      const formattedTime = unbanDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      });
      const content = activeBan.note;
      const msgText = `❌ Bạn đang bị cấm thực hiện hành động "buy" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
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

    if (!message.clan_id) {
      const content = `[Buy] Bạn chỉ có thể mua bán trong clan!`;

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
    if (message.username === 'Anonymous') {
      const content = `[Buy] Anonymous can't use this command!`;

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

    const messageid = message.message_id;

    const onlyBuySyntax =
      message?.content?.t && typeof message.content.t === 'string'
        ? message.content.t.trim() === '*buy'
        : false;

    const embed: EmbedProps[] = [
      {
        color: getRandomColor(),
        title: `[buy]`,
        fields: [
          {
            name: 'description:',
            value: '',
            inputs: {
              id: `buy-${messageid}-description-ip`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `buy-${messageid}-description-plhder`,
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
              id: `buy-${messageid}-totalAmount-ip`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `buy-${messageid}-totalAmount-plhder`,
                required: true,
                defaultValue: 10000,
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
            id: `buy_CANCEL_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${messageid}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `buy_SUBMITCREATE_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${messageid}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Create`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
        ],
      },
    ];
    if (onlyBuySyntax) {
      const messBuy = await messageChannel?.reply({
        embed,
        components,
      });
      if (!messBuy) return;
      const dataMezonBotMessage = {
        messageId: messBuy.message_id,
        userId: message.sender_id,
        clanId: message.clan_id,
        isChannelPublic: message.is_public,
        modeMessage: message.mode,
        channelId: message.channel_id,
        createAt: Date.now(),
      };
      await this.mezonBotMessageRepository.insert(dataMezonBotMessage);
      return;
    }
  }
}
