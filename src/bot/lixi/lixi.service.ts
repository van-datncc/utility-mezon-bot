import {
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
  MezonClient,
} from 'mezon-sdk';

import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { User } from 'src/bot/models/user.entity';
import { EmbebButtonType, FuncType } from 'src/bot/constants/configs';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';
import { EUserError } from '../constants/error';

@Injectable()
export class LixiService {
  private client: MezonClient;
  private listUserClickLixi: Map<string, Set<string>> = new Map();
  private listUserReceive: any[] = [];
  private lixiClickBuckets: Map<string, Map<number, { users: any[] }>> =
    new Map();
  private lixiTimeouts: Map<string, Map<number, NodeJS.Timeout>> = new Map();
  private lixiCanceled: Map<string, boolean> = new Map();
  private lixiProcessingQueue: Map<string, boolean> = new Map();
  private lixiDistributionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private clientService: MezonClientService,
  ) {
    this.client = this.clientService.getClient();
    this.listUserReceive = [];
  }

  generateButtonComponents(data, lixis?) {
    return [
      {
        components: [
          {
            id: `lixi_CANCEL_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}_${lixis.totalAmount}_${lixis.numLixi}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `lixi_LIXI_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}_${lixis.totalAmount}_${lixis.numLixi}_${data.minPerPerson}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Lixi`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
        ],
      },
    ];
  }
  private getRandomUsers(users: any[], count: number): any[] {
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async handleCancelLixi(data, findMessageLixi, authId, lixiMoney) {
    if (data.user_id !== authId) {
      return;
    }
    const key = `${data.message_id}-${data.channel_id}`;

    this.lixiCanceled.set(key, true);

    const channel = await this.client.channels.fetch(data.channel_id);
    const messsage = await channel.messages.fetch(data.message_id);
    const textCancel = 'Cancel lixi successful!';
    const msgCancel = {
      t: textCancel,
      mk: [{ type: EMarkdownType.PRE, s: 0, e: textCancel.length }],
    };

    await messsage.update(msgCancel);

    await this.mezonBotMessageRepository.update(
      {
        id: findMessageLixi.id,
      },
      { deleted: true },
    );

    const findUser = await this.userRepository.findOne({
      where: { user_id: authId },
    });
    if (!findUser) return;
    findUser.amount = Number(findUser.amount) + Number(lixiMoney);
    if (isNaN(findUser.amount)) {
      return;
    }
    await this.userRepository.save(findUser);

    // Clean up any buckets and timeouts for this lixi
    this.lixiClickBuckets.delete(key);
    const timeoutMap = this.lixiTimeouts.get(key);
    if (timeoutMap) {
      for (const timeout of timeoutMap.values()) {
        clearTimeout(timeout);
      }
      this.lixiTimeouts.delete(key);
    }
  }

  addUserClick(lixiId: string, userId: string) {
    if (!this.listUserClickLixi.has(lixiId)) {
      this.listUserClickLixi.set(lixiId, new Set());
    }

    this.listUserClickLixi.get(lixiId)!.add(userId);
  }

  async handleSubmitCreate(
    data,
    authId,
    msgId,
    clanId,
    mode,
    isPublic,
    color,
    authorName,
  ) {
    console.log('data', data);
    console.log('authId', authId);
    console.log('msgId', msgId);
    console.log('clanId', clanId);
    console.log('mode', mode);
    console.log('isPublic', isPublic);
    console.log('color', color);
    if (data.user_id !== authId) {
      return;
    }
    const channel = await this.client.channels.fetch(data.channel_id);
    const messsage = await channel.messages.fetch(data.message_id);

    let parsedExtraData;

    console.log('data.extra_data', data.extra_data);
    try {
      parsedExtraData = JSON.parse(data.extra_data);
    } catch (error) {
      const content = 'Invalid form data provided';
      return await messsage.update({
        t: content,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: content.length }],
      });
    }

    console.log('msgId', msgId);

    const description = parsedExtraData[`lixi-${msgId}-description-ip`] || '';
    const totalAmountStr =
      parsedExtraData[`lixi-${msgId}-totalAmount-ip`] || '0';
    const minLixiStr = parsedExtraData[`lixi-${msgId}-minLixi-ip`] || '0';
    const numLixiStr = parsedExtraData[`lixi-${msgId}-numLixi`] || '0';

    const totalAmountValue = parseInt(totalAmountStr, 10);
    const minLixiValue = parseInt(minLixiStr, 10);
    const numLixiValue = parseInt(numLixiStr, 10);

    console.log('totalAmountValue', totalAmountValue);
    console.log('minLixiValue', minLixiValue);
    console.log('numLixiValue', numLixiValue);

    if (
      isNaN(totalAmountValue) ||
      totalAmountValue % 10000 !== 0 ||
      isNaN(minLixiValue) ||
      minLixiValue % 10000 !== 0 ||
      isNaN(numLixiValue) ||
      numLixiValue <= 0 ||
      minLixiValue < 0 ||
      totalAmountValue < 0
    ) {
      const content = `[Lixi]
      - [totalAmount]: Tổng số tiền lixi
      - [minLixi]: giá trị nhỏ nhất của lixi
      - [numLixi]: số lượng lixi
      Note: 
        [totalAmount] và [minLixi] phải bội số của 10000
        [numLixi] phải là số nguyên dương
        Lixi sẽ chia đều khi [totalAmount] = [minLixi] * [numLixi]`;

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
    let balance = totalAmountValue - numLixiValue * minLixiValue;
    if (balance < 0) {
      const content = `[Lixi] [totalAmount] < [minLixi] * [numLixi]`;

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

    let result = Array(numLixiValue).fill(minLixiValue);

    let diff = totalAmountValue - result.reduce((a, b) => a + b, 0);
    while (diff >= 10000) {
      const i = Math.floor(Math.random() * result.length);
      result[i] += 10000;
      diff -= 10000;
    }
    const resultEmbed = {
      color: getRandomColor(),
      title: `[Lixi] ${description}`,
      description: `Tổng: ${totalAmountValue.toLocaleString()}đ
          Số lượng lixi: 0/${numLixiValue}
          `,
    };
    const lixiDetail = {
      totalAmount: totalAmountValue,
      numLixi: numLixiValue,
    };
    const components = this.generateButtonComponents(
      {
        sender_id: authId,
        clan_id: clanId,
        mode: mode,
        is_public: isPublic,
        color: color,
        clan_nick: authorName,
        totalAmount: totalAmountValue,
        numLixi: numLixiValue,
        minPerPerson: minLixiValue,
      },
      lixiDetail,
    );

    const findUser = await this.userRepository.findOne({
      where: { user_id: authId },
    });

    if (!findUser)
      return await messsage.update({
        t: EUserError.INVALID_USER,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: EUserError.INVALID_USER.length,
          },
        ],
      });

    if ((findUser.amount || 0) < totalAmountValue || isNaN(findUser.amount)) {
      return await messsage.update({
        t: EUserError.INVALID_AMOUNT,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: EUserError.INVALID_AMOUNT.length,
          },
        ],
      });
    }
    findUser.amount = Number(findUser.amount) - Number(totalAmountValue);
    await this.userRepository.save(findUser);
    await messsage.update({
      embed: [resultEmbed],
      components,
    });
    await this.mezonBotMessageRepository.update(
      {
        messageId: data.message_id,
        channelId: data.channel_id,
      },
      {
        content: `${totalAmountValue}_${minLixiValue}_${numLixiValue}`,
        lixiResult: [result, totalAmountValue, [], description],
      },
    );
    return;
  }
  getClickedUsers(key: string): string[] {
    const users = this.listUserClickLixi.get(key);
    return users ? Array.from(users) : [];
  }

  async splitRandomLixiToUsersKeepRemainder(
    userIds: string[],
    numLixi: number,
    totalAmount: number,
    minPerPerson: number,
  ): Promise<{
    results: { user_id: string; amount: number }[];
    leftover: number;
  }> {
    const actualNumLixi = Math.min(numLixi, userIds.length);
    const minTotal = actualNumLixi * minPerPerson;
    const selected = [...userIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, actualNumLixi);

    const results = selected.map((user_id) => ({
      user_id,
      amount: minPerPerson,
    }));

    const leftover = totalAmount - minTotal;

    return { results, leftover };
  }

  async handleSelectLixi(data: any) {
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
      totalAmountStr,
      numLixiStr,
      msgId,
      minPerPersonStr,
    ] = data.button_id.split('_');

    const totalAmount = Number(totalAmountStr);
    const numLixi = Number(numLixiStr);
    const minPerPerson = Number(minPerPersonStr);
    const user = await this.userRepository.findOne({
      where: { user_id: data.user_id },
    });

    if (!user) return;
    const activeBan = Array.isArray(user.ban)
      ? user.ban.find(
          (ban) =>
            (ban.type === FuncType.LIXI || ban.type === FuncType.ALL) &&
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
    const [amounts, lixiMoney, details, description] =
      findMessageLixi.lixiResult;

    if (typeButtonRes === EmbebButtonType.CANCEL) {
      await this.handleCancelLixi(data, findMessageLixi, authId, lixiMoney);
    }
    if (typeButtonRes === EmbebButtonType.SUBMITCREATE) {
      await this.handleSubmitCreate(
        data,
        authId,
        msgId,
        clanId,
        mode,
        isPublic,
        color,
        authorName,
      );
    }
    if (typeButtonRes === EmbebButtonType.LIXI) {
      if (this.lixiCanceled.get(key)) return;

      if (data.user_id === authId) return;

      if (amounts.length === 0) return;

      const bucket = this.lixiClickBuckets.get(key);
      if (bucket) {
        const hasClicked = Array.from(bucket.values()).some((b) =>
          b.users.some((u) => u.user_id === data.user_id),
        );
        if (hasClicked) return;
      }

      const hasUserInQueue =
        this.listUserClickLixi.has(key) &&
        this.listUserClickLixi.get(key)!.has(data.user_id);
      if (hasUserInQueue) return;

      if (this.lixiProcessingQueue.has(key) && !this.listUserClickLixi.has(key))
        return;

      this.addUserClick(key, data.user_id);

      this.queueLixiDistribution(
        data,
        key,
        authId,
        numLixi,
        totalAmount,
        minPerPerson,
        clanId,
        mode,
        isPublic,
        color,
        authorName,
      );
    }
  }

  async queueLixiDistribution(
    data: any,
    key: string,
    authId: string,
    numLixi: number,
    totalAmount: number,
    minPerPerson: number,
    clanId: string,
    mode: string,
    isPublic: boolean,
    color: string,
    authorName: string,
  ) {
    console.log('key', key);
    console.log('authId', authId);
    console.log('numLixi', numLixi);
    console.log('totalAmount', totalAmount);
    console.log('minPerPerson', minPerPerson);
    console.log('clanId', clanId);
    console.log('mode', mode);
    console.log('isPublic', isPublic);
    console.log('color', color);
    if (!this.lixiProcessingQueue.has(key)) {
      this.lixiProcessingQueue.set(key, true);

      const timeout = setTimeout(async () => {
        try {
          const channel = await this.client.channels.fetch(data.channel_id);
          const message = await channel.messages.fetch(data.message_id);

          const findMessageLixi = await this.mezonBotMessageRepository.findOne({
            where: {
              messageId: data.message_id,
              channelId: data.channel_id,
              deleted: false,
            },
          });

          if (!findMessageLixi) return;
          const [amounts, lixiMoney, details, description] =
            findMessageLixi.lixiResult;

          const allUsers = this.getClickedUsers(key).filter(
            (userId) => userId !== authId,
          );

          let chosenLixiAmount = 0;
          const selectedUsers = this.getRandomUsers(
            allUsers,
            Math.min(allUsers.length, amounts.length),
          );

          console.log('selectedUsers', selectedUsers);

          for (const userId of selectedUsers) {
            const chosenAmount =
              amounts.length > 0 ? amounts.splice(0, 1)[0] : minPerPerson;

            const findUser = await this.userRepository.findOne({
              where: { user_id: userId },
            });
            if (!findUser) continue;

            const currentAmount = Number(findUser.amount);
            const amountToAdd = Number(chosenAmount);

            if (isNaN(currentAmount) || isNaN(amountToAdd)) {
              continue;
            }

            details.push({
              username: findUser.username,
              amount: chosenAmount,
            });

            findUser.amount = currentAmount + amountToAdd;
            chosenLixiAmount += chosenAmount;
            await this.userRepository.save(findUser);
          }

          await this.mezonBotMessageRepository.update(
            {
              messageId: data.message_id,
              channelId: data.channel_id,
            },
            {
              lixiResult: [amounts, lixiMoney - chosenLixiAmount, details],
            },
          );

          const receiverList = details
            .map((d) => `- ${d.username}: ${d.amount.toLocaleString()}đ`)
            .join('\n');

          const resultEmbed = {
            color: getRandomColor(),
            title: `[Lixi] ${description || ''}`,
            description: `Tổng: ${totalAmount.toLocaleString()}đ
                Số lượng lixi: ${numLixi - amounts.length}/${numLixi}
                Người nhận:
                ${receiverList}
                `,
          };

          if (amounts.length === 0) {
            await message.update({ embed: [resultEmbed] });
          } else {
            const lixiDetail = {
              totalAmount: totalAmount,
              numLixi: numLixi,
            };

            const components = this.generateButtonComponents(
              {
                sender_id: authId,
                clan_id: clanId,
                mode: mode,
                is_public: isPublic,
                color: color,
                clan_nick: authorName,
                totalAmount: totalAmount,
                numLixi: numLixi,
                minPerPerson: minPerPerson,
              },
              lixiDetail,
            );
            await message.update({ embed: [resultEmbed], components });
          }
        } catch (error) {
          console.error('Lỗi khi xử lý lixi:', error);
        } finally {
          this.lixiProcessingQueue.delete(key);
          this.lixiDistributionTimeouts.delete(key);
        }
      }, 1000);

      this.lixiDistributionTimeouts.set(key, timeout);
    }
  }
}
