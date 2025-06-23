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
import { EUserError } from '../constants/error';
import { UserCacheService } from 'src/bot/services/user-cache.service';

interface LixiDetail {
  user_id?: string;
  username: string;
  amount: number;
}

@Injectable()
export class LixiService {
  private client: MezonClient;
  private lixiCanceled: Map<string, boolean> = new Map();

  // New structures for better event handling
  private lixiClickQueue: Map<
    string,
    { user_id: string; username: string; timestamp: number }[]
  > = new Map();
  private lixiProcessingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private lixiCompleted: Map<string, boolean> = new Map();
  private lixiProcessing: Map<string, boolean> = new Map();

  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private clientService: MezonClientService,
    private userCacheService: UserCacheService,
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
      numLixiValue < 1 ||
      minLixiValue <= 0 ||
      totalAmountValue <= 0
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
      color: color,
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

    try {
      const findUser = await this.userCacheService.getUserFromCache(authId);

      if (!findUser) {
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
      }

      const currentBalance = findUser.amount || 0;
      if (currentBalance < totalAmountValue || isNaN(currentBalance)) {
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

      const balanceResult = await this.userCacheService.updateUserBalance(
        authId,
        -totalAmountValue,
        0,
        10,
      );

      if (!balanceResult.success) {
        const errorMessage = balanceResult.error || 'Failed to update balance';
        return await messsage.update({
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
          lixiResult: [
            result,
            totalAmountValue,
            [] as LixiDetail[],
            description,
          ],
        },
      );
    } catch (error) {
      console.error('Error in handleSubmitCreate:', error);
      const errorMessage = 'Có lỗi xảy ra khi tạo lixi. Vui lòng thử lại.';
      return await messsage.update({
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

    return;
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

      if (!data.user_id) return;

      const user = await this.userCacheService.getUserFromCache(data.user_id);

      if (!user) return;

      const banStatus = await this.userCacheService.getUserBanStatus(
        data.user_id,
        FuncType.LIXI,
      );

      if (banStatus.isBanned) return;

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
    this.markLixiCompleted(key); // This will clean up all handlers

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

      const refundResult = await this.userCacheService.updateUserBalance(
        authId,
        Number(lixiMoney),
        0,
        10,
      );

      if (!refundResult.success) {
        console.error('Failed to refund lixi money:', refundResult.error);
      }

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
    if (this.lixiCompleted.get(key)) return;

    const [amounts, lixiMoney, details, description] =
      findMessageLixi.lixiResult;

    if (amounts.length === 0) return;
    if (details.some((d) => d.user_id === data.user_id)) return;

    if (details.length >= numLixi) return;

    // Check if user already clicked
    const clickQueue = this.lixiClickQueue.get(key) || [];
    if (clickQueue.some((u) => u.user_id === data.user_id)) return;

    if (!this.lixiClickQueue.has(key)) {
      this.lixiClickQueue.set(key, []);
    }

    this.lixiClickQueue.get(key)!.push({
      user_id: data.user_id,
      username: data.username || user.username,
      timestamp: Date.now(),
    });

    // Start processing timeout if not already started
    if (!this.lixiProcessingTimeouts.has(key)) {
      const processingTimeout = setTimeout(() => {
        this.processLixiQueue(
          key,
          data,
          numLixi,
          totalAmount,
          authId,
          clanId,
          mode,
          isPublic,
          color,
          authorName,
          minPerPerson,
          description,
        );
      }, 500); // 1 second delay

      this.lixiProcessingTimeouts.set(key, processingTimeout);
    }
  }

  private async processLixiQueue(
    key: string,
    originalData: any,
    numLixi: number,
    totalAmount: number,
    authId: string,
    clanId: string,
    mode: string,
    isPublic: boolean,
    color: string,
    authorName: string,
    minPerPerson: number,
    description: string,
  ) {
    if (this.lixiCanceled.get(key) || this.lixiCompleted.get(key)) {
      return;
    }

    // Prevent concurrent processing for the same key
    if (this.lixiProcessing.get(key)) {
      return;
    }

    // Set processing flag
    this.lixiProcessing.set(key, true);

    try {
      // Clear timeout since we're processing now
      this.lixiProcessingTimeouts.delete(key);

      const clickQueue = this.lixiClickQueue.get(key) || [];
      if (clickQueue.length === 0) {
        return;
      }

      // Get latest data from database
      const latestMessageData = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: originalData.message_id,
          channelId: originalData.channel_id,
        },
      });

      if (!latestMessageData || !latestMessageData.lixiResult) {
        return;
      }

      const [latestAmounts, lixiMoney, latestDetails] =
        latestMessageData.lixiResult;

      if (latestDetails.length >= numLixi || latestAmounts.length === 0) {
        this.markLixiCompleted(key);
        return;
      }

      const eligibleUsers = clickQueue.filter(
        (u) => !latestDetails.some((d) => d.user_id === u.user_id),
      );

      if (eligibleUsers.length === 0) {
        return;
      }

      const remainingSlots = numLixi - latestDetails.length;
      const maxEligibleUsers = Math.min(
        eligibleUsers.length,
        latestAmounts.length,
        remainingSlots,
      );

      if (maxEligibleUsers <= 0) {
        this.markLixiCompleted(key);
        return;
      }

      const selectedUsers = this.getRandomUsers(
        eligibleUsers,
        maxEligibleUsers,
      );

      if (!selectedUsers.length) {
        return;
      }

      const userIds = selectedUsers
        .map((u) => u.user_id)
        .filter((id) => id !== undefined) as string[];
      const userDataPromises = userIds.map((userId) =>
        this.userCacheService.getUserFromCache(userId),
      );

      const userData = await Promise.all(userDataPromises);
      const validUsers = userData.filter((user) => user !== null);

      if (validUsers.length === 0) {
        return;
      }

      let chosenLixiAmount = 0;
      const newDetails = [...latestDetails];
      const amountsToUpdate = [...latestAmounts];
      const balanceUpdates: Array<{ userId: string; amount: number }> = [];

      for (
        let i = 0;
        i < selectedUsers.length && amountsToUpdate.length > 0;
        i++
      ) {
        const selectedUser = selectedUsers[i];
        const user = validUsers.find((u) => u.user_id === selectedUser.user_id);

        if (!user) continue;

        const chosenAmount = amountsToUpdate.shift() || minPerPerson;

        const lixiDetail: LixiDetail = {
          user_id: selectedUser.user_id,
          username: user.username as string,
          amount: chosenAmount,
        };

        newDetails.push(lixiDetail);
        chosenLixiAmount += chosenAmount;

        if (selectedUser.user_id) {
          balanceUpdates.push({
            userId: selectedUser.user_id,
            amount: chosenAmount,
          });
        }
      }

      if (newDetails.length > numLixi) {
        newDetails.splice(numLixi);
      }

      // Update database first check
      await this.mezonBotMessageRepository.update(
        {
          messageId: originalData.message_id,
          channelId: originalData.channel_id,
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

      const balancePromises = balanceUpdates.map(({ userId, amount }) =>
        this.userCacheService.updateUserBalance(userId, amount, 0, 5),
      );

      await Promise.allSettled(balancePromises);

      // Update UI
      if (chosenLixiAmount > 0) {
        await this.updateLixiMessage(
          key,
          originalData,
          totalAmount,
          numLixi,
          color,
          description,
        );
      }

      // Check if completed
      if (amountsToUpdate.length === 0 || newDetails.length >= numLixi) {
        this.markLixiCompleted(key);
      } else {
        // If not completed, and there are still users in queue who haven't been processed
        const remainingEligibleUsers = clickQueue.filter(
          (u) => !newDetails.some((d) => d.user_id === u.user_id),
        );

        if (remainingEligibleUsers.length > 0) {
          // Start another timeout for remaining users
          const nextProcessingTimeout = setTimeout(() => {
            this.processLixiQueue(
              key,
              originalData,
              numLixi,
              totalAmount,
              authId,
              clanId,
              mode,
              isPublic,
              color,
              authorName,
              minPerPerson,
              description,
            );
          }, 500);

          this.lixiProcessingTimeouts.set(key, nextProcessingTimeout);
        }
      }
    } catch (error) {
      console.error(`[Lixi] Error processing queue for ${key}:`, error);
    } finally {
      // Always clear processing flag
      this.lixiProcessing.delete(key);
    }
  }

  private async updateLixiMessage(
    key: string,
    originalData: any,
    totalAmount: number,
    numLixi: number,
    color: string,
    description: string,
  ) {
    try {
      const channel = await this.client.channels.fetch(originalData.channel_id);
      if (!channel) return;

      const message = await channel.messages.fetch(originalData.message_id);
      if (!message) return;

      // Get the most up-to-date data from database
      const updatedMessageData = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: originalData.message_id,
          channelId: originalData.channel_id,
        },
      });

      if (!updatedMessageData || !updatedMessageData.lixiResult) return;

      const [updatedAmounts, __, latestReceivers] =
        updatedMessageData.lixiResult;

      const receivers = latestReceivers;
      const receiverList = receivers
        .map((d) => `- ${d.username}: ${d.amount.toLocaleString()}đ`)
        .join('\n');

      const resultEmbed = {
        color: color,
        title: `[Lì xì] ${description || ''}`,
        description: `Tổng: ${totalAmount.toLocaleString()}đ
            Số lượng lì xì: ${receivers.length}/${numLixi}
            Người nhận: 
            ${receiverList}
            `,
      };

      if (updatedAmounts.length === 0 || receivers.length >= numLixi) {
        await message.update({ embed: [resultEmbed] });
      } else {
        const lixiDetail = {
          totalAmount: totalAmount,
          numLixi: numLixi,
        };

        const components = this.generateButtonComponents(
          {
            sender_id: originalData.user_id,
            clan_id: originalData.clan_id,
            mode: 'mode',
            is_public: true,
            color: color,
            clan_nick: 'authorName',
            totalAmount,
            numLixi,
            minPerPerson: 10000,
          },
          lixiDetail,
        );

        await message.update({ embed: [resultEmbed], components });
      }
    } catch (error) {
      console.error(`[Lixi] Error updating message for ${key}:`, error);
    }
  }

  private markLixiCompleted(key: string) {
    this.lixiCompleted.set(key, true);
    const processingTimeout = this.lixiProcessingTimeouts.get(key);
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      this.lixiProcessingTimeouts.delete(key);
    }

    this.lixiClickQueue.delete(key);
    this.lixiProcessing.delete(key);
  }

  private cleanupLixi(key: string) {
    this.lixiCanceled.delete(key);
    this.lixiClickQueue.delete(key);
    this.lixiCompleted.delete(key);
    this.lixiProcessing.delete(key);

    const processingTimeout = this.lixiProcessingTimeouts.get(key);
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      this.lixiProcessingTimeouts.delete(key);
    }
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
