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
import { bankOptions } from 'src/bot/constants/options';
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

  generateEmbedMsgListBuy(
    title: string,
    color: string,
    embedComponents: any,
    option: any,
    sellerId?: string,
  ) {
    const fields: any[] = [
      {
        name: '',
        value: '',
        inputs: {
          id: `MyBuyOrder`,
          type: EMessageComponentType.RADIO,
          component: embedComponents,
        },
      },
    ];

    if (sellerId) {
      fields.push(
        {
          name: 'TKNH:',
          value: '',
          inputs: {
            id: `tknh`,
            type: EMessageComponentType.SELECT,
            component: {
              options: bankOptions,
              required: true,
              valueSelected: bankOptions[0],
              valueSelectedLabel: bankOptions[0].label,
            },
          },
        },
        {
          name: 'STK:',
          value: '',
          inputs: {
            id: `stk`,
            type: EMessageComponentType.INPUT,
            component: {
              id: `buy-${option.id}-stk-plhder`,
              required: true,
              defaultValue: 'Nhap so tai khoan',
              type: 'text',
            },
          },
        },
        {
          name: 'Price:',
          value: '',
          inputs: {
            id: `price`,
            type: EMessageComponentType.INPUT,
            component: {
              id: `price`,
              required: true,
              defaultValue: option.amount,
              type: 'number',
            },
          },
        },
      );
    }

    console.log('fields', fields);

    return [
      {
        color,
        title: `[ListBuyOrder]`,
        description: 'Select the option you want sell',
        fields,
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
          sellerId: data,
        }),
        description: `Amount: ${option?.amount ? `${option?.amount.toLocaleString()}đ` : '0'} \n By: ${option.buyerName} ${option.sellerId ? '\n Đang được giao dịch' : ''}`,
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
          if (!transaction || transaction.sellerId) {
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
          const transactions = await this.transactionP2PRepository.find({
            where: {
              clanId: clanId || '',
              deleted: false,
              status: false,
            },
          });

          const embedCompoents = this.generateEmbedComponentListBuys(
            transactions,
            data.user_id,
          );
          const embed: EmbedProps[] = this.generateEmbedMsgListBuy(
            '',
            color,
            embedCompoents,
            transaction,
            data.user_id,
          );

          const components = this.generateButtonComponents({
            sender_id: authId,
            clan_id: clanId,
            mode: mode,
            is_public: isPublic,
            color: color,
            clan_nick: authorName,
            type: 'Save',
          });

          await messsage.update({ embed, components });
          return;
        }
      }
      if (typeButtonRes === EmbebButtonType.SAVE) {
        const rawOrderList = JSON.parse(data.extra_data);

        console.log('rawOrderList', rawOrderList);

        const tknhValue = bankOptions[rawOrderList.tknh];
        const stkValue = rawOrderList.stk;

        if (
          !Number.isInteger(Number(stkValue)) ||
          !tknhValue ||
          stkValue <= 0
        ) {
          const content = `[Bank]
        - [tknh]: phải có tknh
        - [stk]: phải có stk , là số > 0`;

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
          transaction.sellerId = buyOrder.sellerId;
          transaction.tknh = tknhValue.label;
          transaction.stk = rawOrderList.stk;

          await this.transactionP2PRepository.save(transaction);

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

          transaction.sellerId = data.user_id;
          await this.transactionP2PRepository.save(transaction);
          const transactions = await this.transactionP2PRepository.find({
            where: {
              clanId: clanId || '',
              deleted: false,
              status: false,
            },
          });

          const embedCompoents =
            this.generateEmbedComponentListBuys(transactions);
          const embed: EmbedProps[] = this.generateEmbedMsgListBuy(
            '',
            color,
            embedCompoents,
            transaction,
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
              description: `Bạn đang yêu cầu giao dịch mã: BUY${buyOrder.id} với ${buyer.username}, hãy liên hệ với họ`,
              timestamp: new Date().toISOString(),
              footer: MEZON_EMBED_FOOTER,
            },
          ];

          const embedSell = [
            {
              color,
              title: `[Sell]`,
              description: `${findUser.username} đã yêu cầu giao dịch mã: BUY${buyOrder.id}, với giá ${rawOrderList.price} ,TKNH ${tknhValue.label} và STK ${rawOrderList.stk}`,
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

          await seller.sendDM({ embed: embedbuy });
          const messSell = await buyer.sendDM({
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

        transaction.sellerId = '';
        transaction.tknh = '';
        transaction.stk = '';
        await this.transactionP2PRepository.save(transaction);
        const embedbuy = [
          {
            color,
            title: `[Buy]`,
            description: `Bạn đã hủy giao dịch mã: BUY${transacionId}`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        const messBuy = await buyer.sendDM({
          embed: embedbuy,
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
            description: `${findUser.username} đã yêu cầu hủy giao dịch mã: BUY${transacionId}`,
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
            description: `Giao dịch mã: BUY${transacionId} đã báo cáo đến admin, hãy liên hệ Admin để được phản hồi sớm nhất`,
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

        // Check if the user is the buyer
        if (transaction.buyerId !== data.user_id) {
          return;
        }

        // Update buyer's message to indicate waiting for seller confirmation
        const embedBuyerWaiting = [
          {
            color,
            title: `[Waiting for seller]`,
            description: `Đã xác nhận hoàn thành giao dịch mã: BUY${transacionId}, đang chờ người bán xác nhận`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        // Update the current message if it exists
        if (transaction.message && transaction.message.length > 0) {
          const messageIdBuy = transaction.message[0].id;
          const channel = await this.client.channels.fetch(
            transaction.message[0].channel_id,
          );
          const msg = await channel?.messages.fetch(messageIdBuy);
          msg?.update({ embed: embedBuyerWaiting });
        }

        // Send confirmation request to seller
        const embedSellerConfirm = [
          {
            color,
            title: `[Confirm transaction]`,
            description: `Người mua đã xác nhận hoàn thành giao dịch mã: BUY${transacionId}. Vui lòng xác nhận để hoàn thành giao dịch.`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        const componentSellerConfirm = [
          {
            components: [
              {
                id: `sellerConfirm_CONFIRM_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${sellerId}_${buyerId}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Confirm`,
                  style: EButtonMessageStyle.SUCCESS,
                },
              },
              {
                id: `sellerConfirm_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${sellerId}_${buyerId}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Report`,
                  style: EButtonMessageStyle.DANGER,
                },
              },
            ],
          },
        ];

        const messSellerConfirm = await seller.sendDM({
          embed: embedSellerConfirm,
          components: componentSellerConfirm,
        });

        if (!messSellerConfirm) {
          return;
        }

        // Update transaction with seller confirmation message
        transaction.message = transaction.message || [];
        transaction.message.push({
          id: messSellerConfirm.message_id,
          clan_id: '0',
          channel_id: messSellerConfirm.channel_id,
          content: embedSellerConfirm,
        });

        // Mark transaction as pending seller confirmation
        transaction.pendingSellerConfirmation = true;
        await this.transactionP2PRepository.save(transaction);
      }
    } catch (error) {
      console.error('Error in handleSelectConfirmBuy:', error);
    }
  }

  async handleSellerConfirm(data) {
    try {
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

      // Check if the user is the seller
      if (data.user_id !== sellerId) {
        return;
      }

      const transaction = await this.transactionP2PRepository.findOne({
        where: { id: transacionId || '', deleted: false },
      });

      if (!transaction || !transaction.pendingSellerConfirmation) {
        return;
      }

      if (typeButtonRes === EmbebButtonType.CONFIRM) {
        const findUserBuyer = await this.userRepository.findOne({
          where: { user_id: buyerId },
        });

        const findUserSeller = await this.userRepository.findOne({
          where: { user_id: sellerId },
        });

        if (!findUserBuyer || !findUserSeller) return;

        if (
          isNaN(Number(findUserBuyer.amount)) ||
          isNaN(Number(findUserSeller.amount))
        ) {
          return;
        }

        // Complete the transaction by transferring tokens
        findUserBuyer.amount =
          Number(findUserBuyer.amount) + Number(transaction.amount);
        findUserSeller.amount =
          Number(findUserSeller.amount) - Number(transaction.amount);

        await this.userRepository.save(findUserBuyer);
        await this.userRepository.save(findUserSeller);

        transaction.deleted = true;
        transaction.status = true;
        transaction.pendingSellerConfirmation = false;
        await this.transactionP2PRepository.save(transaction);

        // Notify both parties that the transaction is complete
        const embedDone = [
          {
            color,
            title: `[Done transaction]`,
            description: `Giao dịch mã: BUY${transacionId} đã được hoàn thành`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        // Update both seller and buyer messages
        for (const message of transaction.message) {
          const messageChannel = await this.client.channels.fetch(
            message.channel_id,
          );
          const messageObj = await messageChannel?.messages.fetch(message.id);
          messageObj?.update({ embed: embedDone, components: [] });
        }
      } else if (typeButtonRes === EmbebButtonType.REPORT) {
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
            description: `Giao dịch mã: BUY${transacionId} đã báo cáo đến admin, hãy liên hệ Admin để được phản hồi sớm nhất`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        await buyer.sendDM({ embed: embed });
        await seller.sendDM({ embed: embed });

        const embedAdmin = [
          {
            color,
            title: `[report]`,
            description: `${seller.username} đã gửi báo cáo giao dịch mã: BUY${transacionId}`,
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
    } catch (error) {
      console.error('Error in handleSellerConfirm:', error);
    }
  }
}
