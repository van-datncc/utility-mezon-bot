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
import {
  EmbebButtonType,
} from 'src/bot/constants/configs';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor } from 'src/bot/utils/helps';

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
      const [amounts, lixiMoney, details] = findMessageLixi.lixiResult;
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
          title: 'Lixi',
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
    } catch (error) {}
  }
}
