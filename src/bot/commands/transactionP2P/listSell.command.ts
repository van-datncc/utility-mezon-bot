import { ChannelMessage, ChannelMessageAck, EMarkdownType } from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { getRandomColor } from 'src/bot/utils/helps';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { EmbedProps } from 'src/bot/constants/configs';
import { TransactionP2P } from 'src/bot/models/transactionP2P.entity';
import { SellService } from './sell.service';

@Command('listsell')
export class ListSellCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(TransactionP2P)
    private transactionP2PRepository: Repository<TransactionP2P>,
    private transactionP2PServiceRepository: SellService,
  ) {
    super(clientService);
  }

  async execute(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    if (!message.clan_id) {
      const content = `[Listsell] Bạn chỉ có thể mua bán trong clan!`;

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
      const content = `[Listsell] Anonymous can't use this command!`;

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

    const onlyBuySyntax =
      message?.content?.t && typeof message.content.t === 'string'
        ? message.content.t.trim() === '*listsell'
        : false;
    const transactions = await this.transactionP2PRepository.find({
      where: {
        clanId: message.clan_id || '',
        sellerId: Not(IsNull()),
        status: false,
        deleted: false,
      },
    });

    if (transactions.length === 0) {
      const content = `[Listsell] Không có giao dịch nào!`;

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

    const color = getRandomColor();

    const embedCompoents =
      this.transactionP2PServiceRepository.generateEmbedComponentListSells(
        transactions,
      );
    const embed: EmbedProps[] =
      this.transactionP2PServiceRepository.generateEmbedMsgListSell(
        '',
        color,
        embedCompoents,
      );

    const components =
      this.transactionP2PServiceRepository.generateButtonComponents({
        ...message,
        color: color,
        type: 'Buy',
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
