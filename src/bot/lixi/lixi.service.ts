import {
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
  MezonClient,
  MezonUpdateRoleBody,
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
  private blockEditedList: string[] = [];
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
            id: `lixi_LIXI_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}_${lixis.totalAmount}_${lixis.numLixi}`,
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
  private lixiClickBuckets: Map<string, Map<number, { users: any[] }>> =
    new Map();
  private lixiTimeouts: Map<string, Map<number, NodeJS.Timeout>> = new Map();
  private lixiCanceled: Map<string, boolean> = new Map();
  async handleSelectLixi(data) {
    try {
      const key = `${data.message_id}-${data.channel_id}`;

      if (!this.lixiClickBuckets.has(key)) {
        this.lixiClickBuckets.set(key, new Map());
      }

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
      ] = data.button_id.split('_');

      const channel = await this.client.channels.fetch(data.channel_id);
      const messsage = await channel.messages.fetch(data.message_id);

      const isPublicBoolean = isPublic === 'true' ? true : false;
      const totalAmount = Number(totalAmountStr);
      const numLixi = Number(numLixiStr);

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
      const bucket = this.lixiClickBuckets.get(key)!;
      if (typeButtonRes === EmbebButtonType.CANCEL) {
        if (data.user_id !== authId) {
          return;
        }
        this.lixiCanceled.set(key, true);
        const textCancel = '```Cancel lixi successful!```';
        const msgCancel = {
          t: textCancel,
          mk: [{ type: EMarkdownType.TRIPLE, s: 0, e: textCancel.length }],
        };
        await this.mezonBotMessageRepository.update(
          {
            id: findMessageLixi.id,
          },
          { deleted: true },
        );
        await messsage.update(msgCancel);
        const findUser = await this.userRepository.findOne({
          where: { user_id: authId },
        });
        if (!findUser) return;
        findUser.amount = Number(findUser.amount) + Number(lixiMoney);
        if (isNaN(findUser.amount)) {
          return;
        }
        await this.userRepository.save(findUser);
      }

      if (typeButtonRes === EmbebButtonType.LIXI) {
        if (data.user_id === authId) {
          return;
        }
        if (this.lixiCanceled.get(key)) {
          return;
        }
        if (amounts.length === 0) return;
        const hasClicked = Array.from(bucket.values()).some((b) =>
          b.users.some((u) => u.user_id === data.user_id),
        );
        if (hasClicked) {
          return;
        }

        const existingTimestamps = Array.from(bucket.keys()).sort(
          (a, b) => b - a,
        );
        const latestTimestamp = existingTimestamps[0];
        let future = latestTimestamp;
        const now = Math.floor(Date.now() / 1000);
        if (!latestTimestamp || latestTimestamp < now) {
          future = now + 1;
          bucket.set(future, { users: [] });
        }
        const targetBucket = bucket.get(future);
        if (targetBucket) {
          targetBucket.users.push({
            user_id: data.user_id,
            username: data.username,
          });
        }

        if (!this.lixiTimeouts.has(key)) {
          this.lixiTimeouts.set(key, new Map());
        }
        const timeoutMap = this.lixiTimeouts.get(key)!;

        if (!timeoutMap.has(future)) {
          const timeout = setTimeout(
            async () => {
              if (this.lixiCanceled.get(key)) {
                this.lixiClickBuckets.delete(key);
                const tmap = this.lixiTimeouts.get(key);
                if (tmap) {
                  for (const t of tmap.values()) clearTimeout(t);
                  this.lixiTimeouts.delete(key);
                }
                return;
              }
              const bucket = this.lixiClickBuckets.get(key)!;
              const bucketAtTime = bucket.get(future);
              if (!bucketAtTime) return;

              const allUsers = bucketAtTime.users;
              let selectedUsers: typeof allUsers;

              if (allUsers.length <= numLixi) {
                selectedUsers = this.getRandomUsers(allUsers, allUsers.length);
              } else {
                selectedUsers = this.getRandomUsers(allUsers, numLixi);
              }
              let chosenLixiAmount = 0;
              for (const u of selectedUsers) {
                const chosenAmount = amounts.splice(0, 1)[0];
                const findUser = await this.userRepository.findOne({
                  where: { user_id: u.user_id },
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

                findUser.amount =
                  Number(findUser.amount) + Number(chosenAmount);
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
              const dataGenerateButtonComponents = {
                sender_id: authId,
                clan_id: clanId,
                mode,
                is_public: isPublicBoolean,
                color,
                username: authorName,
              };
              const lixiDetail = {
                totalAmount: totalAmount,
                numLixi: numLixi,
              };

              const components = this.generateButtonComponents(
                dataGenerateButtonComponents,
                lixiDetail,
              );

              if (Number(numLixi - amounts.length) === Number(numLixi)) {
                await messsage.update({ embed: [resultEmbed] });
                this.lixiClickBuckets.delete(key);

                const timeoutMap = this.lixiTimeouts.get(key);
                if (timeoutMap) {
                  for (const timeout of timeoutMap.values()) {
                    clearTimeout(timeout);
                  }
                  this.lixiTimeouts.delete(key);
                }
              } else {
                await messsage.update({ embed: [resultEmbed], components });
              }
            },
            (future - now) * 1000,
          );

          timeoutMap.set(future, timeout);
        }
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
        const description = `lixi-${msgId}-description-ip`;
        const totalAmount = `lixi-${msgId}-totalAmount-ip`;
        const minLixi = `lixi-${msgId}-minLixi-ip`;
        const numLixi = `lixi-${msgId}-numLixi`;
        const descriptionValue = parsedExtraData[description] || '';
        const totalAmountValue = Number(parsedExtraData[totalAmount]);
        const minLixiValue = Number(parsedExtraData[minLixi]);
        const numLixiValue = Number(parsedExtraData[numLixi]);

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
          const content =
            '```' +
            `[Lixi]
        - [totalAmount]: Tổng số tiền lixi
        - [minLixi]: giá trị nhỏ nhất của lixi
        - [numLixi]: số lượng lixi
        Note: 
          [totalAmount] và [minLixi] phải bội số của 10000
          [numLixi] phải là số nguyên dương
          Lixi sẽ chia đều khi [totalAmount] = [minLixi] * [numLixi]` +
            '```';

          return await messsage.update({
            t: content,
            mk: [
              {
                type: EMarkdownType.TRIPLE,
                s: 0,
                e: content.length + 6,
              },
            ],
          });
        }
        let balance = totalAmountValue - numLixiValue * minLixiValue;
        if (balance < 0) {
          const content =
            '```' +
            `[Lixi]
        [totalAmount] < [minLixi] * [numLixi]` +
            '```';
          return await messsage.update({
            t: content,
            mk: [
              {
                type: EMarkdownType.TRIPLE,
                s: 0,
                e: content.length + 6,
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
          title: `[Lixi] ${descriptionValue}`,
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
                type: EMarkdownType.TRIPLE,
                s: 0,
                e: EUserError.INVALID_USER.length,
              },
            ],
          });

        if (
          (findUser.amount || 0) < totalAmountValue ||
          isNaN(findUser.amount)
        ) {
          return await messsage.update({
            t: EUserError.INVALID_AMOUNT,
            mk: [
              {
                type: EMarkdownType.TRIPLE,
                s: 0,
                e: EUserError.INVALID_AMOUNT.length,
              },
            ],
          });
        }
        findUser.amount = Number(findUser.amount) - Number(totalAmountValue);
        await this.userRepository.save(findUser);
        messsage.update({
          embed: [resultEmbed],
          components,
        });
        await this.mezonBotMessageRepository.update(
          {
            messageId: data.message_id,
            channelId: data.channel_id,
          },
          {
            content: `${totalAmountValue} + '_' + ${minLixiValue} + '_' + ${numLixiValue}`,
            lixiResult: [result, totalAmountValue, [], descriptionValue],
          },
        );
        return;
      }
    } catch (error) {}
  }
}
