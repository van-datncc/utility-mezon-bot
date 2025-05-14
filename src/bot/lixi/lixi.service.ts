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
import { EmbebButtonType } from 'src/bot/constants/configs';
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

  async handleSelectLixi(data) {
    try {
      if (
        this.blockEditedList.includes(`${data.message_id}-${data.channel_id}`)
      )
        return;
      const [
        _,
        typeButtonRes,
        authId,
        clanId,
        mode,
        isPublic,
        color,
        authorName,
        totalAmount,
        numLixi,
        msgId,
      ] = data.button_id.split('_');

      const channel = await this.client.channels.fetch(data.channel_id);
      const messsage = await channel.messages.fetch(data.message_id);

      const isPublicBoolean = isPublic === 'true' ? true : false;
      const findMessageLixi = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: data.message_id,
          channelId: data.channel_id,
          deleted: false,
        },
      });

      if (!findMessageLixi) return;

      const [amounts, lixiMoney, details, description] = findMessageLixi.lixiResult;
      if (typeButtonRes === EmbebButtonType.CANCEL) {
        if (data.user_id !== authId) {
          return;
        }
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
        await this.userRepository.save(findUser);
      }

      if (typeButtonRes === EmbebButtonType.LIXI) {
        const findUser = await this.userRepository.findOne({
          where: { user_id: data.user_id },
        });
        if (!findUser) return;

        const exists = details.some((d) => d.username === findUser.username);
        if (exists) return;
        if (amounts.length === 0) {
          return;
        }
        const randomIdx = Math.floor(Math.random() * amounts.length);
        const chosenAmount = amounts.splice(randomIdx, 1)[0];
        details.push({ username: findUser.username, amount: chosenAmount });
        await this.mezonBotMessageRepository.update(
          {
            messageId: data.message_id,
            channelId: data.channel_id,
          },
          { lixiResult: [amounts, lixiMoney - chosenAmount, details] },
        );
        findUser.amount = Number(findUser.amount) + Number(chosenAmount);
        await this.userRepository.save(findUser);
        const receiverList = details
          .map((d) => `- ${d.username}: ${d.amount.toLocaleString()}đ`)
          .join('\n');

        // update message
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
        } else {
          await messsage.update({ embed: [resultEmbed], components });
        }
      }

      if (typeButtonRes === EmbebButtonType.SUBMITCREATE) {
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
          numLixiValue <= 0
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
        console.log('minLixiValue: ', minLixiValue);
        console.log('numLixiValue: ', numLixiValue);
        console.log('totalAmountValue: ', totalAmountValue);
        
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
