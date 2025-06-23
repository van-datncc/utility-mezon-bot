import {
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
  MezonClient,
} from 'mezon-sdk';

import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { User } from 'src/bot/models/user.entity';
import {
  EmbebButtonType,
  EmbedProps,
  FuncType,
  MEZON_EMBED_FOOTER,
} from 'src/bot/constants/configs';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { TransactionP2P } from 'src/bot/models/transactionP2P.entity';
// import { EUserError } from '../constants/error';

@Injectable()
export class BuyService {
  private client: MezonClient;
  private blockEditedList: string[] = [];
  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(TransactionP2P)
    private transactionP2PRepository: Repository<TransactionP2P>,
    private clientService: MezonClientService,
  ) {
    this.client = this.clientService.getClient();
  }

  generateEmbedComponents(options, data?) {
    const embedCompoents = options.map((option, index) => {
      return {
        label: `${option.note.trim() ? `${option.note.trim()}` : 'buy token'}`,
        value: JSON.stringify({
          note: option.note,
          id: option.id,
          amount: option.amount,
          buyerId: option.buyerId,
          buyerName: option.buyerName,
        }),
        description: `Amount: ${option?.amount ? `${option?.amount.toLocaleString()}đ` : '0'}\n By: ${option.buyerName} ${option.amountLock.username ? '\n Đang được giao dịch' : ''}`,
        style: EButtonMessageStyle.SUCCESS,
        name: option.id,
        disabled: option.amountLock.username ? true : false,
      };
    });
    return embedCompoents;
  }

  generateEmbedMessage(title: string, color: string, embedCompoents) {
    return [
      {
        color,
        title: `[MyBuyOrder] \n ${title}`,
        description: 'Select the option you want.',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `MyBuyOrder`,
              type: EMessageComponentType.RADIO,
              component: embedCompoents,
              // max_option: 5,
            },
          },
        ],
        timestamp: new Date().toISOString(),
        footer: MEZON_EMBED_FOOTER,
      },
    ];
  }

  generateEmbedMsgListBuy(title: string, color: string, embedCompoents) {
    return [
      {
        color,
        title: `[ListBuyOrder]`,
        description: 'Select the option you want sell',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `MyBuyOrder`,
              type: EMessageComponentType.RADIO,
              component: embedCompoents,
              // max_option: 5,
            },
          },
        ],
        timestamp: new Date().toISOString(),
        footer: MEZON_EMBED_FOOTER,
      },
    ];
  }

  generateEmbedComponentListBuys(options, data?) {
    const embedCompoents = options.map((option, index) => {
      return {
        label: `${option.note.trim() ? `${option.note.trim()}` : 'buy token'}`,
        value: JSON.stringify({
          note: option.note,
          id: option.id,
          amount: option.amount,
          buyerId: option.buyerId,
          buyerName: option.buyerName,
        }),
        description: `Amount: ${option?.amount ? `${option?.amount.toLocaleString()}đ` : '0'} \n By: ${option.buyerName} ${option?.amountLock?.username ? '\n Đang được giao dịch' : ''}`,
        style: EButtonMessageStyle.SUCCESS,
        disabled: option?.amountLock?.username ? true : false,
      };
    });
    return embedCompoents;
  }

  generateButtonComponents(data) {
    const type = (data.type || '').toUpperCase();
    return [
      {
        components: [
          {
            id: `buy_CANCEL_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `buy_${type}_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `${data.type}`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
        ],
      },
    ];
  }

  async handleSelectBuy(data) {
    try {
      const key = `${data.message_id}-${data.channel_id}`;

      const [
        _,
        typeButtonRes,
        authId,
        clanId,
        mode,
        isPublic,
        color,
        authorName,
        msgId,
      ] = data.button_id.split('_');
      const channel = await this.client.channels.fetch(data.channel_id);
      const seller = await channel.clan.users.fetch(data.user_id);
      const messsage = await channel.messages.fetch(data.message_id);
      const findUser = await this.userRepository.findOne({
        where: { user_id: data.user_id },
      });
      if (!findUser) return;

      const activeBan = Array.isArray(findUser.ban)
        ? findUser.ban.find(
            (ban) =>
              (ban.type === FuncType.TRANSACTION ||
                ban.type === FuncType.ALL) &&
              ban.unBanTime > Math.floor(Date.now() / 1000),
          )
        : null;

      if (activeBan) {
        return;
      }

      const findMessageLixi = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: data.message_id,
          channelId: data.channel_id,
          deleted: false,
        },
      });

      if (!findMessageLixi) return;

      if (typeButtonRes === EmbebButtonType.CANCEL) {
        if (data.user_id !== authId) {
          return;
        }
        const textCancel = 'Cancel buy successful!';
        const msgCancel = {
          t: textCancel,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: textCancel.length }],
        };
        await this.mezonBotMessageRepository.update(
          {
            id: findMessageLixi.id,
          },
          { deleted: true },
        );
        await messsage.update(msgCancel);
      }

      if (typeButtonRes === EmbebButtonType.SUBMITCREATE) {
        if (data.user_id !== authId) {
          return;
        }
        let parsedExtraData;
        try {
          parsedExtraData = JSON.parse(data.extra_data);
        } catch (error) {
          throw new Error('Invalid JSON in extra_data');
        }
        const description = `buy-${msgId}-description-ip`;
        const totalAmount = `buy-${msgId}-totalAmount-ip`;
        const descriptionValue = parsedExtraData[description] || '';
        const totalAmountValue = Number(parsedExtraData[totalAmount]);

        if (
          isNaN(totalAmountValue) ||
          !Number.isInteger(totalAmountValue) ||
          totalAmountValue <= 0
        ) {
          const content = `[buy]
        - [totalAmount]: Tổng số tiền buy phải là số tự nhiên lớn hơn 0`;

          return await messsage.update({
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
        const resultEmbed = {
          color: getRandomColor(),
          title: `[buy] ${descriptionValue}`,
          description: `Token: ${totalAmountValue.toLocaleString()}đ`,
        };

        messsage.update({
          embed: [resultEmbed],
        });

        const dataTransaction = {
          clanId: clanId,
          buyerId: authId,
          buyerName: findUser.username,
          note: descriptionValue,
          amount: totalAmountValue,
        };

        await this.transactionP2PRepository.insert(dataTransaction);
        return;
      }

      if (typeButtonRes === EmbebButtonType.DELETE) {
        if (data.user_id !== authId) {
          return;
        }
        const rawOrderList = JSON.parse(data.extra_data);
        const parsedOrders = rawOrderList.MyBuyOrder.map((item) =>
          JSON.parse(item),
        );
        const transactions = await this.transactionP2PRepository.find({
          where: {
            clanId: clanId || '',
            buyerId: authId,
            deleted: false,
            sellerId: IsNull(),
          },
        });

        for (const buyOrder of parsedOrders) {
          const tx = transactions.find((t) => t.id === buyOrder.id);
          if (!tx) continue;
          if (Object.keys(tx?.amountLock || {}).length !== 0) {
            continue;
          }
          await this.transactionP2PRepository.update(
            {
              id: buyOrder.id,
            },
            { deleted: true },
          );
        }

        const remainingTransactions = await this.transactionP2PRepository.find({
          where: {
            clanId: clanId || '',
            buyerId: authId,
            deleted: false,
            sellerId: IsNull(),
          },
        });
        const embedCompoents = this.generateEmbedComponents(
          remainingTransactions,
        );
        const embed: EmbedProps[] = this.generateEmbedMessage(
          '',
          color,
          embedCompoents,
        );

        const components = this.generateButtonComponents({
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublic,
          color: color,
          clan_nick: authorName,
          type: 'Delete',
        });
        if (remainingTransactions.length > 0) {
          await messsage.update({ embed, components });
        } else {
          await messsage.update({ embed });
        }
        return;
      }

      if (typeButtonRes === EmbebButtonType.SELL) {
        const rawOrderList = JSON.parse(data.extra_data);
        const parsedOrders = rawOrderList.MyBuyOrder.map((item) =>
          JSON.parse(item),
        );
        for (const buyOrder of parsedOrders) {
          if (data.user_id === buyOrder.buyerId) {
            return;
          }
          const buyer = await channel.clan.users.fetch(buyOrder.buyerId);
          if (isNaN(buyOrder.amount) || Number(buyOrder.amount) <= 0) {
            return;
          }
          const transaction = await this.transactionP2PRepository.findOne({
            where: { id: buyOrder.id || '', deleted: false },
          });
          if (!transaction) {
            return;
          }
          if (Object.keys(transaction?.amountLock || {}).length !== 0) {
            continue;
          }

          if (
            (findUser.amount || 0) < Number(buyOrder.amount) ||
            isNaN(findUser.amount)
          ) {
            const content = `[transacion] - \n❌Số dư của bạn không đủ hoặc không hợp lệ!`;
            return await seller.sendDM({
              t: content,
              mk: [{ type: EMarkdownType.PRE, s: 0, e: content.length }],
            });
          }

          findUser.amount = Number(findUser.amount) - Number(buyOrder.amount);
          await this.userRepository.save(findUser);
          transaction.amountLock = {
            username: findUser.username,
            amount: buyOrder.amount,
          };
          await this.transactionP2PRepository.save(transaction);
          const transactions = await this.transactionP2PRepository.find({
            where: { clanId: clanId || '', deleted: false, sellerId: IsNull() },
          });

          const embedCompoents =
            this.generateEmbedComponentListBuys(transactions);
          const embed: EmbedProps[] = this.generateEmbedMsgListBuy(
            '',
            color,
            embedCompoents,
          );
          const components = this.generateButtonComponents({
            sender_id: authId,
            clan_id: clanId,
            mode: mode,
            is_public: isPublic,
            color: color,
            clan_nick: authorName,
            type: 'Sell',
          });
          await messsage.update({ embed, components });
          const embedbuy = [
            {
              color,
              title: `[Buy]`,
              description: `${findUser.username} đã yêu cầu giao dịch mã: BUY${buyOrder.id}, hãy liên hệ với họ`,
              timestamp: new Date().toISOString(),
              footer: MEZON_EMBED_FOOTER,
            },
          ];
          await buyer.sendDM({ embed: embedbuy });

          const embedSell = [
            {
              color,
              title: `[Sell]`,
              description: `Bạn đang yêu cầu giao dịch mã: BUY${buyOrder.id} với ${buyer.username}, hãy liên hệ với họ`,
              timestamp: new Date().toISOString(),
              footer: MEZON_EMBED_FOOTER,
            },
          ];

          const componentSells = [
            {
              components: [
                {
                  id: `confirmBuy_CANCEL_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${buyOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Cancel`,
                    style: EButtonMessageStyle.SECONDARY,
                  },
                },
                {
                  id: `confirmBuy_DONE_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${buyOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Done`,
                    style: EButtonMessageStyle.SUCCESS,
                  },
                },
                {
                  id: `confirmBuy_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${buyOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Report`,
                    style: EButtonMessageStyle.DANGER,
                  },
                },
              ],
            },
          ];
          const messSell = await seller.sendDM({
            embed: embedSell,
            components: componentSells,
          });
          if (!messSell) {
            return;
          }

          transaction.message = [
            ...(transaction.message || []),
            {
              id: messSell.message_id,
              clan_id: '0',
              channel_id: messSell.channel_id,
              content: embedbuy,
            },
          ];
          await this.transactionP2PRepository.save(transaction);
          return;
        }
      }
    } catch (error) {}
  }

  async handleSelectConfirmBuy(data) {
    try {
      const key = `${data.message_id}-${data.channel_id}`;

      const [
        _,
        typeButtonRes,
        authId,
        clanId,
        mode,
        isPublic,
        color,
        authorName,
        transacionId,
        sellerId,
        buyerId,
      ] = data.button_id.split('_');
      const clan = await this.client.clans.fetch('0');
      const seller = await clan.users.fetch(sellerId);
      const buyer = await clan.users.fetch(buyerId);
      const findUser = await this.userRepository.findOne({
        where: { user_id: data.user_id },
      });
      if (!findUser) return;
      if (typeButtonRes === EmbebButtonType.CANCEL) {
        const transaction = await this.transactionP2PRepository.findOne({
          where: { id: transacionId || '', deleted: false },
        });
        if (!transaction) {
          return;
        }
        const embedbuy = [
          {
            color,
            title: `[Buy]`,
            description: `${findUser.username} đã yêu cầu hủy giao dịch mã: BUY${transacionId}, hãy confirm nếu không có vẫn đề gì và hoặc report để báo cáo admin`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        const componentBuys = [
          {
            components: [
              {
                id: `confirmBuy_CONFIRM_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${seller.id}_${buyer.id}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Confirm`,
                  style: EButtonMessageStyle.SUCCESS,
                },
              },
              {
                id: `confirmBuy_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${seller.id}_${buyer.id}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Report`,
                  style: EButtonMessageStyle.DANGER,
                },
              },
            ],
          },
        ];
        const messBuy = await buyer.sendDM({
          embed: embedbuy,
          components: componentBuys,
        });
        if (!messBuy) {
          return;
        }

        transaction.message = [
          ...(transaction.message || []),
          {
            id: messBuy.message_id,
            clan_id: '0',
            channel_id: messBuy.channel_id,
            content: embedbuy,
          },
        ];
        await this.transactionP2PRepository.save(transaction);

        const embedSell = [
          {
            color,
            title: `[Sell]`,
            description: `Bạn đã yêu cầu hủy giao dịch mã: BUY${transacionId} với ${buyer.username}, hãy liên hệ với họ để họ xác nhận`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await seller.sendDM({ embed: embedSell });
      }

      if (typeButtonRes === EmbebButtonType.CONFIRM) {
        const transaction = await this.transactionP2PRepository.findOne({
          where: { id: transacionId || '', deleted: false },
        });
        if (!transaction) {
          return;
        }

        const findUser = await this.userRepository.findOne({
          where: { username: transaction.amountLock.username },
        });
        if (!findUser) return;

        findUser.amount =
          Number(findUser.amount) + Number(transaction.amountLock.amount);
        await this.userRepository.save(findUser);

        transaction.amountLock = {};
        await this.transactionP2PRepository.save(transaction);

        const embedbuy = [
          {
            color,
            title: `[Buy]`,
            description: `Bạn đã xác nhận yêu cầu hủy giao dịch mã: BUY${transacionId}`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await buyer.sendDM({ embed: embedbuy });

        const embedSell = [
          {
            color,
            title: `[Sell]`,
            description: `${buyer.username} đã xác nhận yêu cầu hủy giao dịch mã: BUY${transacionId}`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await seller.sendDM({ embed: embedSell });

        if (transaction?.message.length > 0) {
          for (const message of transaction?.message) {
            const channel = await this.client.channels.fetch(
              message.channel_id,
            );
            const msg = await channel?.messages.fetch(message.id);
            msg?.update({ embed: message.content });
          }
        }
      }

      if (typeButtonRes === EmbebButtonType.REPORT) {
        const transaction = await this.transactionP2PRepository.findOne({
          where: { id: transacionId || '', deleted: false },
        });
        if (!transaction) {
          return;
        }

        const bot = await this.userRepository.findOne({
          where: { user_id: process.env.UTILITY_BOT_ID || '' },
        });
        if (!bot) {
          return;
        }

        const embed = [
          {
            color,
            title: `[Report]`,
            description: `Giao dịch mã: BUY${transacionId} đã báo cáo đến admin, hãy liên hệ ${bot.invitor[clanId]} để được phản hồi sớm nhất`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await buyer.sendDM({ embed: embed });
        await seller.sendDM({ embed: embed });
        let usernamereport = '';
        if (data.user_id === sellerId) {
          usernamereport = seller.username;
        } else {
          usernamereport = buyer.username;
        }
        const embedAdmin = [
          {
            color,
            title: `[report]`,
            description: `${usernamereport} đã gửi báo cáo giao dịch mã: BUY${transacionId}`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        const admindb = await this.userRepository.findOne({
          where: { username: bot.invitor[clanId] || '' },
        });
        const admin = await clan.users.fetch(admindb?.user_id || '');
        await admin.sendDM({ embed: embedAdmin });
      }

      if (typeButtonRes === EmbebButtonType.DONE) {
        const transaction = await this.transactionP2PRepository.findOne({
          where: { id: transacionId || '', deleted: false },
        });
        if (!transaction) {
          return;
        }

        const findUser = await this.userRepository.findOne({
          where: { user_id: buyer.id },
        });
        if (!findUser) return;

        if (
          isNaN(
            Number(findUser.amount) + Number(transaction.amountLock.amount),
          ) ||
          isNaN(Number(findUser.amount)) ||
          isNaN(Number(transaction.amountLock.amount))
        ) {
          return;
        }
        findUser.amount =
          Number(findUser.amount) + Number(transaction.amountLock.amount);
        await this.userRepository.save(findUser);

        transaction.deleted = true;
        await this.transactionP2PRepository.save(transaction);

        const embed = [
          {
            color,
            title: `[Buy]`,
            description: `Giao dịch mã: BUY${transacionId} đã được hoàn thành`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await buyer.sendDM({ embed: embed });
        await seller.sendDM({ embed: embed });
        if (transaction?.message.length > 0) {
          for (const message of transaction?.message) {
            const channel = await this.client.channels.fetch(
              message.channel_id,
            );
            const msg = await channel?.messages.fetch(message.id);
            msg?.update({ embed: message.content });
          }
        }
      }
    } catch (error) {}
  }
}
