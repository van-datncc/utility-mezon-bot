import {
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
  MezonClient,
} from 'mezon-sdk';

import { IsNull, Not, Repository } from 'typeorm';
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
export class SellService {
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
        label: `${option.note.trim() ? `${option.note.trim()}` : 'sell token'}`,
        value: JSON.stringify({
          note: option.note,
          id: option.id,
          amount: option.amount,
          sellerId: option.sellerId,
          sellerName: option.sellerName,
        }),
        description: `Amount: ${option?.amount ? `${option?.amount.toLocaleString()}đ` : '0'}\n By: ${option.amountLock.username} ${option.buyerId ? '\n Đang được giao dịch' : ''}`,
        style: EButtonMessageStyle.SUCCESS,
        name: option.id,
        disabled: option.buyerId ? true : false,
      };
    });
    return embedCompoents;
  }

  generateEmbedMessage(title: string, color: string, embedCompoents) {
    return [
      {
        color,
        title: `[MySellOrder] \n ${title}`,
        description: 'Select the option you want.',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `MySellOrder`,
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

  generateEmbedMsgListSell(title: string, color: string, embedCompoents) {
    return [
      {
        color,
        title: `[ListSellOrder]`,
        description: 'Select the option you want sell',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `MySellOrder`,
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

  generateEmbedComponentListSells(options, data?) {
    const embedCompoents = options.map((option, index) => {
      return {
        label: `${option.note.trim() ? `${option.note.trim()}` : 'sell token'}`,
        value: JSON.stringify({
          note: option.note,
          id: option.id,
          amount: option.amount,
          sellerId: option.sellerId,
          sellerName: option.sellerName,
          tknh: option.tknh,
          stk: option.stk,
          status: option.status,
        }),
        description: `Amount: ${option?.amount ? `${option?.amount.toLocaleString()}đ` : '0'} \n By: ${option.amountLock.username}  ${option.status ? `\nTKNH: ${option.tknh}\nSTK: ${option.stk}\nĐang được giao dịch` : ''}`,
        style: EButtonMessageStyle.SUCCESS,
        disabled: option.buyerId ? true : false,
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
            id: `sell_CANCEL_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `sell_${type}_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
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

  async handleSelectSell(data) {
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
      const buyer = await channel.clan.users.fetch(data.user_id);
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
        const description = `sell-${msgId}-description-ip`;
        const totalAmount = `sell-${msgId}-totalAmount-ip`;
        const tknh = `sell-${msgId}-tknh-ip`;
        const stk = `sell-${msgId}-stk-ip`;
        const descriptionValue = parsedExtraData[description] || '';
        const totalAmountValue = Number(parsedExtraData[totalAmount]);
        const stkValue = Number(parsedExtraData[stk]);

        const labelBank = bankOptions[parsedExtraData[tknh]].label;

        if (
          isNaN(totalAmountValue) ||
          !Number.isInteger(totalAmountValue) ||
          !labelBank ||
          !Number.isInteger(stkValue) ||
          !tknh ||
          totalAmountValue <= 0
        ) {
          const content = `[Sell]
        - [totalAmount]: Tổng số tiền sell phải là số tự nhiên lớn hơn 0
        - [tknh]: phải có tknh
        - [stk]: phải có stk `;

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

        if (
          (findUser.amount || 0) < totalAmountValue ||
          isNaN(findUser.amount)
        ) {
          const textCancel = '💸Số dư của bạn không đủ!';
          const msgCancel = {
            t: textCancel,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: textCancel.length }],
          };
          return await messsage.update(msgCancel);
        }

        findUser.amount = Number(findUser.amount) - Number(totalAmountValue);
        await this.userRepository.save(findUser);
        const resultEmbed = {
          color: getRandomColor(),
          title: `[Sell] ${descriptionValue}`,
          description: `Token: ${totalAmountValue.toLocaleString()}đ`,
        };

        messsage.update({
          embed: [resultEmbed],
        });

        const dataTransaction = {
          clanId: clanId,
          sellerId: authId,
          sellerName: findUser.username,
          note: descriptionValue,
          amount: totalAmountValue,
          tknh: labelBank,
          stk: stkValue.toString(),
          amountLock: {
            username: findUser.username,
            amount: totalAmountValue,
          },
        };
        await this.transactionP2PRepository.insert(dataTransaction);
        return;
      }

      if (typeButtonRes === EmbebButtonType.DELETE) {
        if (data.user_id !== authId) {
          return;
        }
        const rawOrderList = JSON.parse(data.extra_data);
        const parsedOrders = rawOrderList.MySellOrder.map((item) =>
          JSON.parse(item),
        );
        const transactions = await this.transactionP2PRepository.find({
          where: { clanId: clanId || '', sellerId: authId, deleted: false },
        });

        for (const sellOrder of parsedOrders) {
          const tx = transactions.find((t) => t.id === sellOrder.id);
          if (!tx) continue;
          if (tx.buyerName || tx.buyerId) {
            continue;
          }
          findUser.amount =
            Number(findUser.amount) + Number(tx.amountLock.amount);
          if (isNaN(findUser.amount)) {
            return;
          }
          await this.userRepository.save(findUser);
          await this.transactionP2PRepository.update(
            {
              id: sellOrder.id,
            },
            { deleted: true },
          );
        }

        const remainingTransactions = await this.transactionP2PRepository.find({
          where: { clanId: clanId || '', sellerId: authId, deleted: false },
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

      if (typeButtonRes === EmbebButtonType.BUY) {
        const rawOrderList = JSON.parse(data.extra_data);

        const parsedOrders = rawOrderList.MySellOrder.map((item) =>
          JSON.parse(item),
        );

        for (const sellOrder of parsedOrders) {
          if (data.user_id === sellOrder.sellerId) {
            return;
          }
          const seller = await channel.clan.users.fetch(sellOrder.sellerId);
          if (isNaN(sellOrder.amount) || Number(sellOrder.amount) <= 0) {
            return;
          }
          const transaction = await this.transactionP2PRepository.findOne({
            where: { id: sellOrder.id || '', deleted: false, status: false },
          });

          if (!transaction) {
            return;
          }
          if (transaction.buyerId || transaction.buyerName) {
            continue;
          }

          transaction.buyerId = findUser.user_id;
          transaction.buyerName = findUser.username;
          transaction.status = true;
          await this.transactionP2PRepository.save(transaction);
          const transactions = await this.transactionP2PRepository.find({
            where: {
              clanId: clanId || '',
              deleted: false,
              sellerId: Not(IsNull()),
            },
          });

          const embedCompoents =
            this.generateEmbedComponentListSells(transactions);
          const embed: EmbedProps[] = this.generateEmbedMsgListSell(
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
            type: 'Buy',
          });
          await messsage.update({ embed, components });

          console.log('seller', seller);
          const embedSell = [
            {
              color,
              title: `[Sell]`,
              description: `Bạn đang yêu cầu giao dịch mã: SELL${sellOrder.id} với ${seller.username}, hãy liên hệ với họ`,
              timestamp: new Date().toISOString(),
              footer: MEZON_EMBED_FOOTER,
            },
          ];
          await buyer.sendDM({ embed: embedSell });

          const embedBuy = [
            {
              color,
              title: `[Buy]`,
              description: `${findUser.username} đã yêu cầu giao dịch mã: SELL${sellOrder.id}, hãy liên hệ với họ`,
              timestamp: new Date().toISOString(),
              footer: MEZON_EMBED_FOOTER,
            },
          ];

          const componentBuys = [
            {
              components: [
                {
                  id: `confirmSell_CANCEL_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${sellOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Cancel`,
                    style: EButtonMessageStyle.SECONDARY,
                  },
                },
                {
                  id: `confirmSell_DONE_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${sellOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Done`,
                    style: EButtonMessageStyle.SUCCESS,
                  },
                },
                {
                  id: `confirmSell_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${sellOrder.id}_${seller.id}_${buyer.id}`,
                  type: EMessageComponentType.BUTTON,
                  component: {
                    label: `Report`,
                    style: EButtonMessageStyle.DANGER,
                  },
                },
              ],
            },
          ];
          const messBuy = await seller.sendDM({
            embed: embedBuy,
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
              content: embedBuy,
            },
          ];
          await this.transactionP2PRepository.save(transaction);
          return;
        }
      }
    } catch (error) {}
  }

  async handleBuyerConfirm(data) {
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

      // Check if the user is the buyer
      if (data.user_id !== buyerId) {
        return;
      }

      const transaction = await this.transactionP2PRepository.findOne({
        where: { id: transacionId || '', deleted: false },
      });

      if (!transaction || !transaction.pendingBuyerConfirmation) {
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

        // Complete the transaction by transferring tokens to buyer
        findUserBuyer.amount =
          Number(findUserBuyer.amount) + Number(transaction.amountLock.amount);

        await this.userRepository.save(findUserBuyer);

        transaction.deleted = true;
        transaction.status = true;
        transaction.pendingBuyerConfirmation = false;
        await this.transactionP2PRepository.save(transaction);

        // Notify both parties that the transaction is complete
        const embedDone = [
          {
            color,
            title: `[Done transaction]`,
            description: `Giao dịch mã: SELL${transacionId} đã được hoàn thành`,
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
            description: `Giao dịch mã: SELL${transacionId} đã báo cáo đến admin, hãy liên hệ Admin để được phản hồi sớm nhất`,
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
            description: `${buyer.username} đã gửi báo cáo giao dịch mã: SELL${transacionId}`,
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
      console.error('Error in handleBuyerConfirm:', error);
    }
  }

  async handleSelectConfirmSell(data) {
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

        const messageIdSell = transaction.message[0].id;
        const channel = await this.client.channels.fetch(
          transaction.message[0].channel_id,
        );

        const embedSell = [
          {
            color,
            title: `[Cancel transaction]`,
            description: `Bạn đã yêu cầu hủy giao dịch mã: SELL${transacionId}`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        const msg = await channel?.messages.fetch(messageIdSell);
        msg?.update({ embed: embedSell });

        const embedBuy = [
          {
            color,
            title: `[Sell]`,
            description: `${findUser.username} đã yêu cầu hủy giao dịch mã: SELL${transacionId}, hãy report nếu có vấn đề báo cáo admin`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        const componentSells = [
          {
            components: [
              // {
              //   id: `confirmSell_CONFIRM_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${seller.id}_${buyer.id}`,
              //   type: EMessageComponentType.BUTTON,
              //   component: {
              //     label: `Confirm`,
              //     style: EButtonMessageStyle.SUCCESS,
              //   },
              // },
              {
                id: `confirmSell_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${sellerId}_${buyerId}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Report`,
                  style: EButtonMessageStyle.DANGER,
                },
              },
            ],
          },
        ];

        const messSell = await buyer.sendDM({
          embed: embedBuy,
          components: componentSells,
        });

        if (!messSell) {
          return;
        }

        transaction.buyerId = '';
        transaction.buyerName = '';
        transaction.status = false;
        transaction.message = [];
        transaction.deleted = false;
        await this.transactionP2PRepository.save(transaction);
        return;
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
            description: `Giao dịch mã: SELL${transacionId} đã báo cáo đến admin, hãy liên hệ ${bot.invitor[clanId]} để được phản hồi sớm nhất`,
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
            description: `${usernamereport} đã gửi báo cáo giao dịch mã: SELL${transacionId}`,
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

        // Check if the user is the seller
        if (data.user_id !== sellerId) {
          return;
        }

        const messageIdSell = transaction.message[0].id;
        const channel = await this.client.channels.fetch(
          transaction.message[0].channel_id,
        );

        // Update seller's message to indicate waiting for buyer confirmation
        const embedSellerWaiting = [
          {
            color,
            title: `[Waiting for buyer]`,
            description: `Đã xác nhận hoàn thành giao dịch mã: SELL${transacionId}, đang chờ người mua xác nhận`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];
        const msg = await channel?.messages.fetch(messageIdSell);
        msg?.update({ embed: embedSellerWaiting });

        // Send confirmation request to buyer
        const embedBuyerConfirm = [
          {
            color,
            title: `[Confirm transaction]`,
            description: `Người bán đã xác nhận hoàn thành giao dịch mã: SELL${transacionId}. Vui lòng xác nhận nếu bạn đã nhận được tiền.`,
            timestamp: new Date().toISOString(),
            footer: MEZON_EMBED_FOOTER,
          },
        ];

        const componentBuyerConfirm = [
          {
            components: [
              {
                id: `buyerConfirm_CONFIRM_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${sellerId}_${buyerId}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Confirm`,
                  style: EButtonMessageStyle.SUCCESS,
                },
              },
              {
                id: `buyerConfirm_REPORT_${authId}_${clanId}_${mode}_${isPublic}_${color}_${authorName}_${transacionId}_${sellerId}_${buyerId}`,
                type: EMessageComponentType.BUTTON,
                component: {
                  label: `Report`,
                  style: EButtonMessageStyle.DANGER,
                },
              },
            ],
          },
        ];

        const messBuyerConfirm = await buyer.sendDM({
          embed: embedBuyerConfirm,
          components: componentBuyerConfirm,
        });

        if (!messBuyerConfirm) {
          return;
        }

        // Update transaction with buyer confirmation message
        transaction.message.push({
          id: messBuyerConfirm.message_id,
          clan_id: '0',
          channel_id: messBuyerConfirm.channel_id,
          content: embedBuyerConfirm,
        });

        // Mark transaction as pending buyer confirmation
        transaction.pendingBuyerConfirmation = true;
        await this.transactionP2PRepository.save(transaction);
        return;
      }
    } catch (error) {
      console.error('Error in handleSelectConfirmSell:', error);
    }
  }
}
