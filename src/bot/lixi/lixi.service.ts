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
import { In } from 'typeorm';

interface LixiDetail {
  user_id?: string;
  username: string;
  amount: number;
}

@Injectable()
export class LixiService {
  private client: MezonClient;
  private listUserClickLixi: Map<string, Set<string>> = new Map();
  private lixiClickBuckets: Map<string, Map<number, { users: any[] }>> =
    new Map();
  private lixiTimeouts: Map<string, Map<number, NodeJS.Timeout>> = new Map();
  private lixiCanceled: Map<string, boolean> = new Map();

  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private clientService: MezonClientService,
  ) {
    this.client = this.clientService.getClient();
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
    if (data.user_id !== authId) {
      return;
    }
    const channel = await this.client.channels.fetch(data.channel_id);
    const messsage = await channel.messages.fetch(data.message_id);

    let parsedExtraData;

    try {
      parsedExtraData = JSON.parse(data.extra_data);
    } catch (error) {
      const content = 'Invalid form data provided';
      return await messsage.update({
        t: content,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: content.length }],
      });
    }

    const description = parsedExtraData[`lixi-${msgId}-description-ip`] || '';
    const totalAmountStr =
      parsedExtraData[`lixi-${msgId}-totalAmount-ip`] || '0';
    const minLixiStr = parsedExtraData[`lixi-${msgId}-minLixi-ip`] || '0';
    const numLixiStr = parsedExtraData[`lixi-${msgId}-numLixi`] || '0';

    const totalAmountValue = parseInt(totalAmountStr, 10);
    const minLixiValue = parseInt(minLixiStr, 10);
    const numLixiValue = parseInt(numLixiStr, 10);

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
            type: EMarkdownType.TRIPLE,
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
        lixiResult: [result, totalAmountValue, [] as LixiDetail[], description],
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
        totalAmountStr,
        numLixiStr,
        msgId,
        minPerPersonStr,
      ] = data.button_id.split('_');

      const isPublicBoolean = isPublic === 'true' ? true : false;
      const totalAmount = Number(totalAmountStr);
      const numLixi = Number(numLixiStr);
      const minPerPerson = minPerPersonStr ? Number(minPerPersonStr) : 10000;

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

      if (activeBan) return;

      const findMessageLixi = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: data.message_id,
          channelId: data.channel_id,
          deleted: false,
        },
      });

      if (!findMessageLixi) return;

      switch (typeButtonRes) {
        case EmbebButtonType.CANCEL:
          await this.handleCancelLixi(data, findMessageLixi, authId);
          break;
        case EmbebButtonType.SUBMITCREATE:
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
          break;
        case EmbebButtonType.LIXI:
          await this.handleLixi(
            data,
            key,
            findMessageLixi,
            authId,
            numLixi,
            totalAmount,
            minPerPerson,
            clanId,
            mode,
            isPublicBoolean,
            color,
            authorName,
            user,
          );
          break;
        default:
          console.log(`Unhandled button type: ${typeButtonRes}`);
          break;
      }
    } catch (error) {
      console.error('Error in handleSelectLixi:', error);
    }
  }

  private async handleCancelLixi(
    data: any,
    findMessageLixi: any,
    authId: string,
  ) {
    if (data.user_id !== authId) return;

    const key = `${data.message_id}-${data.channel_id}`;
    const [_, lixiMoney] = findMessageLixi.lixiResult;

    this.lixiCanceled.set(key, true);

    try {
      const channel = await this.client.channels.fetch(data.channel_id);
      const messsage = await channel.messages.fetch(data.message_id);

      const textCancel = 'Cancel lixi successful!';
      const msgCancel = {
        t: textCancel,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: textCancel.length }],
      };

      await this.mezonBotMessageRepository.update(
        { id: findMessageLixi.id },
        { deleted: true },
      );

      await messsage.update(msgCancel);

      const findUser = await this.userRepository.findOne({
        where: { user_id: authId },
      });

      if (!findUser) return;

      findUser.amount = Number(findUser.amount) + Number(lixiMoney);
      if (isNaN(findUser.amount)) return;

      await this.userRepository.save(findUser);
      this.cleanupLixi(key);
    } catch (error) {
      console.error('Error cancelling lixi:', error);
    }
  }

  private async handleLixi(
    data: any,
    key: string,
    findMessageLixi: any,
    authId: string,
    numLixi: number,
    totalAmount: number,
    minPerPerson: number,
    clanId: string,
    mode: string,
    isPublic: boolean,
    color: string,
    authorName: string,
    user: any,
  ) {
    if (data.user_id === authId) return;
    if (this.lixiCanceled.get(key)) return;

    const [amounts, lixiMoney, details, description] =
      findMessageLixi.lixiResult;

    if (amounts.length === 0) return;
    if (details.some((d) => d.user_id === data.user_id)) return;

    if (!this.lixiClickBuckets.has(key)) {
      this.lixiClickBuckets.set(key, new Map());
    }
    const bucket = this.lixiClickBuckets.get(key)!;

    const hasClicked = Array.from(bucket.values()).some((b) =>
      b.users.some((u) => u.user_id === data.user_id),
    );
    if (hasClicked) return;

    const now = Math.floor(Date.now() / 1000);
    const batchWindow = 1;
    const batchTimestamp = Math.floor(now / batchWindow) * batchWindow;

    if (!bucket.has(batchTimestamp)) {
      bucket.set(batchTimestamp, { users: [] });
    }

    const targetBucket = bucket.get(batchTimestamp);
    if (targetBucket) {
      targetBucket.users.push({
        user_id: data.user_id,
        username: data.username || user.username,
      });
    }

    if (!this.lixiTimeouts.has(key)) {
      this.lixiTimeouts.set(key, new Map());
    }

    const timeoutMap = this.lixiTimeouts.get(key)!;
    if (!timeoutMap.has(batchTimestamp)) {
      const timeout = setTimeout(
        () =>
          this.processBatchLixi(
            key,
            batchTimestamp,
            data,
            amounts,
            lixiMoney,
            details,
            description,
            numLixi,
            totalAmount,
            authId,
            clanId,
            mode,
            isPublic,
            color,
            authorName,
            minPerPerson,
          ),
        500,
      );

      timeoutMap.set(batchTimestamp, timeout);
    }
  }

  private async processBatchLixi(
    key: string,
    timestamp: number,
    data: any,
    amounts: number[],
    lixiMoney: number,
    details: any[],
    description: string,
    numLixi: number,
    totalAmount: number,
    authId: string,
    clanId: string,
    mode: string,
    isPublic: boolean,
    color: string,
    authorName: string,
    minPerPerson: number,
  ) {
    if (this.lixiCanceled.get(key)) {
      this.cleanupLixi(key);
      return;
    }

    try {
      const bucket = this.lixiClickBuckets.get(key);
      if (!bucket) return;

      const bucketAtTime = bucket.get(timestamp);
      if (!bucketAtTime || !bucketAtTime.users.length) return;

      const uniqueUsers = bucketAtTime.users.filter(
        (u, index, self) =>
          self.findIndex((u2) => u2.user_id === u.user_id) === index &&
          !details.some((d) => d.user_id === u.user_id),
      );

      if (!uniqueUsers.length) return;

      const eligibleUsers = this.getRandomUsers(
        uniqueUsers,
        Math.min(uniqueUsers.length, amounts.length),
      );

      if (!eligibleUsers.length) return;

      const userIds = eligibleUsers.map((u) => u.user_id);

      const users = await this.userRepository.find({
        where: { user_id: In(userIds) },
      });

      const userMap = new Map(users.map((u) => [u.user_id, u]));

      let chosenLixiAmount = 0;
      const newDetails = [...details];
      const amountsToUpdate = [...amounts];
      const updatedUsers: User[] = [];

      for (const u of eligibleUsers) {
        if (amountsToUpdate.length === 0) break;

        const user = userMap.get(u.user_id);
        if (!user) continue;

        const chosenAmount = amountsToUpdate.shift() || minPerPerson;
        const currentAmount = Number(user.amount);

        if (isNaN(currentAmount) || isNaN(chosenAmount)) continue;

        newDetails.push({
          user_id: u.user_id,
          username: user.username,
          amount: chosenAmount,
        });

        user.amount = currentAmount + chosenAmount;
        chosenLixiAmount += chosenAmount;
        updatedUsers.push(user);
      }

      await this.userRepository.manager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager.update(
            MezonBotMessage,
            {
              messageId: data.message_id,
              channelId: data.channel_id,
            },
            {
              lixiResult: [
                amountsToUpdate,
                lixiMoney - chosenLixiAmount,
                newDetails,
                description,
              ],
            },
          );

          if (updatedUsers.length) {
            await transactionalEntityManager.save(updatedUsers);
          }
        },
      );

      if (chosenLixiAmount > 0) {
        const channel = await this.client.channels.fetch(data.channel_id);
        if (!channel) return;

        const message = await channel.messages.fetch(data.message_id);
        if (!message) return;

        const receiverList = newDetails
          .map((d) => `- ${d.username}: ${d.amount.toLocaleString()}đ`)
          .join('\n');

        const resultEmbed = {
          color: getRandomColor(),
          title: `[Lì xì] ${description || ''}`,
          description: `Tổng: ${totalAmount.toLocaleString()}đ
            Số lượng lì xì: ${numLixi - amountsToUpdate.length}/${numLixi}
            Người nhận: 
            ${receiverList}
            `,
        };

        if (amountsToUpdate.length === 0) {
          await message.update({ embed: [resultEmbed] });
          this.cleanupLixi(key);
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
              totalAmount,
              numLixi,
              minPerPerson,
            },
            lixiDetail,
          );

          await message.update({ embed: [resultEmbed], components });
        }
      }

      bucket.delete(timestamp);

      const timeoutMap = this.lixiTimeouts.get(key);
      if (timeoutMap && timeoutMap.has(timestamp)) {
        timeoutMap.delete(timestamp);
      }

      if (bucket.size === 0) {
        this.lixiClickBuckets.delete(key);
        this.lixiTimeouts.delete(key);
      }
    } catch (error) {
      console.error('Error processing lixi batch:', error);
    }
  }

  private cleanupLixi(key: string) {
    this.lixiClickBuckets.delete(key);
    const timeoutMap = this.lixiTimeouts.get(key);
    if (timeoutMap) {
      for (const timeout of timeoutMap.values()) {
        clearTimeout(timeout);
      }
      this.lixiTimeouts.delete(key);
    }
    this.lixiCanceled.delete(key);
  }

  private getRandomUsers(users: any[], count: number): any[] {
    if (users.length <= count) return users;

    const result = [...users];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result.slice(0, count);
  }
}
