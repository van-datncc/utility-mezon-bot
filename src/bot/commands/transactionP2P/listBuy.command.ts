import { ChannelMessage, ChannelMessageAck, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { getRandomColor } from 'src/bot/utils/helps';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { EmbedProps } from 'src/bot/constants/configs';
import { TransactionP2P } from 'src/bot/models/transactionP2P.entity';
import { BuyService } from './buy.service';

@Command('listbuy')
export class ListBuyCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(TransactionP2P)
    private transactionP2PRepository: Repository<TransactionP2P>,
    private transactionP2PServiceRepository: BuyService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    if (!message.clan_id) {
      const content = `[mybuyorder] Bạn chỉ có thể mua bán trong clan!`;

      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length + 6,
          },
        ],
      });
    }
    if (message.username === 'Anonymous') {
      const content = `[mybuyorder] Anonymous can't use this command!`;

      return await messageChannel?.reply({
        t: content,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: content.length + 6,
          },
        ],
      });
    }

    const messageid = message.message_id;

    const onlyBuySyntax =
      message?.content?.t && typeof message.content.t === 'string'
        ? message.content.t.trim() === '*listbuy'
        : false;
    const transactions = await this.transactionP2PRepository.find({
      where: {
        clanId: message.clan_id || '',
        deleted: false,
        sellerId: IsNull(),
      },
    });

    const color = getRandomColor();

    const embedCompoents =
      this.transactionP2PServiceRepository.generateEmbedComponentListBuys(
        transactions,
      );
    const embed: EmbedProps[] =
      this.transactionP2PServiceRepository.generateEmbedMsgListBuy(
        '',
        color,
        embedCompoents,
      );

    const components =
      this.transactionP2PServiceRepository.generateButtonComponents({
        ...message,
        color: color,
        type: 'Sell',
      });

    if (onlyBuySyntax) {
      let messBuy: ChannelMessageAck | undefined;
      if (transactions.length > 0) {
        messBuy = await messageChannel?.reply({
          embed,
          components,
        });
      } else {
        messBuy = await messageChannel?.reply({
          embed,
        });
      }
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
