import {
  EButtonMessageStyle,
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
import { UserSicbo } from 'src/bot/models/user.sicbo.entity';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { UserCacheService } from '../../services/user-cache.service';

@Injectable()
export class SicboService {
  private client: MezonClient;
  private blockEditedList: string[] = [];
  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(UserSicbo)
    private userSicboRepository: Repository<UserSicbo>,
    @InjectRepository(Sicbo) private sicboRepository: Repository<Sicbo>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private clientService: MezonClientService,
    private userCacheService: UserCacheService,
  ) {
    this.client = this.clientService.getClient();
  }

  generateButtonComponents(data) {
    return [
      {
        components: [
          {
            id: `sicbo_BET5000_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${getRandomColor()}_${data.clan_nick || data.username}_${0}_${0}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `5000`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: `sicbo_BET10000_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${getRandomColor()}_${data.clan_nick || data.username}_${0}_${0}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `10000`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: `sicbo_BET20000_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${getRandomColor()}_${data.clan_nick || data.username}_${0}_${0}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `20000`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: `sicbo_BET50000_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${getRandomColor()}_${data.clan_nick || data.username}_${0}_${0}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `50000`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
        ],
      },
    ];
  }

  generateResultsDefault() {
    return [
      [
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        '6.png',
        '7.png',
        '8.png',
        '9.png',
        '10.png',
        '11.png',
        '12.png',
        '13.png',
        '14.png',
        '15.png',
        '16.png',
        '17.png',
        '18.png',
        '19.png',
        '20.png',
        '21.png',
        '22.png',
        '23.png',
        '24.png',
      ],
      [
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        '6.png',
        '7.png',
        '8.png',
        '9.png',
        '10.png',
        '11.png',
        '12.png',
        '13.png',
        '14.png',
        '15.png',
        '16.png',
        '17.png',
        '18.png',
        '19.png',
        '20.png',
        '21.png',
        '22.png',
        '23.png',
        '24.png',
      ],
      [
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        '6.png',
        '7.png',
        '8.png',
        '9.png',
        '10.png',
        '11.png',
        '12.png',
        '13.png',
        '14.png',
        '15.png',
        '16.png',
        '17.png',
        '18.png',
        '19.png',
        '20.png',
        '21.png',
        '22.png',
        '23.png',
        '24.png',
      ],
    ];
  }

  generateEmbedMessage(
    sic: number,
    bo: number,
    results: string[][],
    endAt: number,
  ) {
    let sicRate = 0;
    let boRate = 0;
    const now = new Date();
    const endTime = new Date(endAt);
    const diffMs = endTime.getTime() - now.getTime();
    const diffSeconds = Math.ceil(diffMs / 1000);
    const diffMinutes = Math.max(0, Math.ceil(diffMs / 60000));

    if (sic > 0 && bo > 0) {
      sicRate = Number((bo / sic).toFixed(2));
      boRate = Number((sic / bo).toFixed(2));
    }
    return [
      {
        color: getRandomColor(),
        title: `🎲 Sicbo 🎲
                Bắt đầu sau: ${diffMinutes} phút`,
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `Sicbo`,
              type: EMessageComponentType.RADIO,
              component: [
                {
                  label: `🎲 Tài (x${sicRate}): ${Number(sic).toLocaleString('vi-VN') || 0}`,
                  value: `1`,
                  style: EButtonMessageStyle.SUCCESS,
                },
                {
                  label: `🎲 Xỉu (x${boRate}): ${Number(bo).toLocaleString('vi-VN') || 0}`,
                  value: `2`,
                  style: EButtonMessageStyle.SUCCESS,
                },
              ],
            },
          },
          {
            name: '',
            value: '',
            inputs: {
              id: `slots`,
              type: EMessageComponentType.ANIMATION,
              component: {
                url_image:
                  'https://cdn.mezon.ai/0/1840682626818510848/1779513150169682000/1747814491095_0spritesheet__7_.png',
                url_position:
                  'https://cdn.mezon.ai/0/1840682626818510848/1779513150169682000/1747814483360_0spritesheet__8_.json',
                pool: results,
                duration: 0.6,
              },
            },
          },
        ],
      },
    ];
  }

  async handleSelectBet(data) {
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
      const allResults: string[][] = this.generateResultsDefault();
      const shuffled = allResults.sort(() => 0.5 - Math.random());
      const results: string[][] = shuffled.slice(0, 3);
      const channel = await this.client.channels.fetch(data.channel_id);
      const messsage = await channel.messages.fetch(data.message_id);
      const findSicbo = await this.sicboRepository.findOne({
        where: { deleted: false },
      });
      if (!findSicbo) return;
      const isPublicBoolean = isPublic === 'true' ? true : false;
      const endAt = Number(findSicbo.endAt);
      if (endAt && new Date(endAt) < new Date()) {
        const resultEmbed = this.generateEmbedMessage(
          Number(findSicbo?.sic) || 0,
          Number(findSicbo?.bo) || 0,
          results,
          Number(findSicbo.endAt),
        );
        const dataMsg = {
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublicBoolean,
          color: color,
          clan_nick: authorName,
          username: authorName,
        };
        const components = this.generateButtonComponents(dataMsg);
        return await messsage.update({ embed: resultEmbed, components });
      }
      const findUser = await this.userRepository.findOne({
        where: { user_id: data.user_id },
      });
      if (!findUser) return;
      const activeBan = Array.isArray(findUser.ban)
        ? findUser.ban.find(
            (ban) =>
              (ban.type === FuncType.SICBO || ban.type === FuncType.ALL) &&
              ban.unBanTime > Math.floor(Date.now() / 1000),
          )
        : null;

      if (activeBan) {
        return;
      }

      if (typeButtonRes === EmbebButtonType.BET5000) {
        const money = 5000;
        // trừ tiền user
        if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
          return;
        }

        const findUserSicbo = await this.userSicboRepository.findOne({
          where: { userId: data.user_id, sicboId: findSicbo.id.toString() },
        });

        const extraData = JSON.parse(data.extra_data);
        const betValue = Number(extraData.Sicbo[0]);
        if (betValue !== 1 && betValue !== 2) {
          return;
        }
        findUser.amount = findUser.amount - money;
        await this.userRepository.save(findUser);
        if (!findUserSicbo) {
          const dataSicbo = {
            userId: data.user_id.toString(),
            sicboId: findSicbo.id.toString(),
            createAt: Date.now(),
            sic: betValue === 1 ? money : 0,
            bo: betValue === 2 ? money : 0,
          };
          await this.userSicboRepository.insert(dataSicbo);

          if (betValue === 1) {
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
        } else {
          if (betValue === 1) {
            findUserSicbo.sic = (Number(findUserSicbo.sic) || 0) + money;
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findUserSicbo.bo = (Number(findUserSicbo.bo) || 0) + money;
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
          await this.userSicboRepository.save(findUserSicbo);
        }
        await this.sicboRepository.save(findSicbo);

        const resultEmbed = this.generateEmbedMessage(
          Number(findSicbo?.sic) || 0,
          Number(findSicbo?.bo) || 0,
          results,
          Number(findSicbo.endAt),
        );
        const dataMsg = {
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublicBoolean,
          color: color,
          clan_nick: authorName,
          username: authorName,
        };
        const components = this.generateButtonComponents(dataMsg);
        await messsage.update({ embed: resultEmbed, components });
      }
      if (typeButtonRes === EmbebButtonType.BET10000) {
        const money = 10000;
        if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
          return;
        }

        const findUserSicbo = await this.userSicboRepository.findOne({
          where: { userId: data.user_id, sicboId: findSicbo.id.toString() },
        });

        const extraData = JSON.parse(data.extra_data);
        const betValue = Number(extraData.Sicbo[0]);
        if (betValue !== 1 && betValue !== 2) {
          return;
        }
        findUser.amount = findUser.amount - money;
        await this.userRepository.save(findUser);
        if (!findUserSicbo) {
          const dataSicbo = {
            userId: data.user_id.toString(),
            sicboId: findSicbo.id.toString(),
            createAt: Date.now(),
            sic: betValue === 1 ? money : 0,
            bo: betValue === 2 ? money : 0,
          };
          await this.userSicboRepository.insert(dataSicbo);

          if (betValue === 1) {
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
        } else {
          if (betValue === 1) {
            findUserSicbo.sic = (Number(findUserSicbo.sic) || 0) + money;
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findUserSicbo.bo = (Number(findUserSicbo.bo) || 0) + money;
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
          await this.userSicboRepository.save(findUserSicbo);
        }
        await this.sicboRepository.save(findSicbo);

        const resultEmbed = this.generateEmbedMessage(
          Number(findSicbo?.sic) || 0,
          Number(findSicbo?.bo) || 0,
          results,
          Number(findSicbo.endAt),
        );
        const dataMsg = {
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublicBoolean,
          color: color,
          clan_nick: authorName,
          username: authorName,
        };
        const components = this.generateButtonComponents(dataMsg);
        await messsage.update({ embed: resultEmbed, components });
      }
      if (typeButtonRes === EmbebButtonType.BET20000) {
        const money = 20000;
        if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
          return;
        }

        const findUserSicbo = await this.userSicboRepository.findOne({
          where: { userId: data.user_id, sicboId: findSicbo.id.toString() },
        });

        const extraData = JSON.parse(data.extra_data);
        const betValue = Number(extraData.Sicbo[0]);
        if (betValue !== 1 && betValue !== 2) {
          return;
        }
        findUser.amount = findUser.amount - money;
        await this.userRepository.save(findUser);
        if (!findUserSicbo) {
          const dataSicbo = {
            userId: data.user_id.toString(),
            sicboId: findSicbo.id.toString(),
            createAt: Date.now(),
            sic: betValue === 1 ? money : 0,
            bo: betValue === 2 ? money : 0,
          };
          await this.userSicboRepository.insert(dataSicbo);

          if (betValue === 1) {
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
        } else {
          if (betValue === 1) {
            findUserSicbo.sic = (Number(findUserSicbo.sic) || 0) + money;
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findUserSicbo.bo = (Number(findUserSicbo.bo) || 0) + money;
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
          await this.userSicboRepository.save(findUserSicbo);
        }
        await this.sicboRepository.save(findSicbo);

        const resultEmbed = this.generateEmbedMessage(
          Number(findSicbo?.sic) || 0,
          Number(findSicbo?.bo) || 0,
          results,
          Number(findSicbo.endAt),
        );
        const dataMsg = {
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublicBoolean,
          color: color,
          clan_nick: authorName,
          username: authorName,
        };
        const components = this.generateButtonComponents(dataMsg);
        await messsage.update({ embed: resultEmbed, components });
      }
      if (typeButtonRes === EmbebButtonType.BET50000) {
        const money = 50000;
        if ((findUser.amount || 0) < money || isNaN(findUser.amount)) {
          return;
        }

        const findUserSicbo = await this.userSicboRepository.findOne({
          where: { userId: data.user_id, sicboId: findSicbo.id.toString() },
        });

        const extraData = JSON.parse(data.extra_data);
        const betValue = Number(extraData.Sicbo[0]);
        if (betValue !== 1 && betValue !== 2) {
          return;
        }
        findUser.amount = findUser.amount - money;
        await this.userRepository.save(findUser);
        if (!findUserSicbo) {
          const dataSicbo = {
            userId: data.user_id.toString(),
            sicboId: findSicbo.id.toString(),
            createAt: Date.now(),
            sic: betValue === 1 ? money : 0,
            bo: betValue === 2 ? money : 0,
          };
          await this.userSicboRepository.insert(dataSicbo);

          if (betValue === 1) {
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
        } else {
          if (betValue === 1) {
            findUserSicbo.sic = (Number(findUserSicbo.sic) || 0) + money;
            findSicbo.sic = (Number(findSicbo.sic) || 0) + money;
          } else {
            findUserSicbo.bo = (Number(findUserSicbo.bo) || 0) + money;
            findSicbo.bo = (Number(findSicbo.bo) || 0) + money;
          }
          await this.userSicboRepository.save(findUserSicbo);
        }
        await this.sicboRepository.save(findSicbo);

        const resultEmbed = this.generateEmbedMessage(
          Number(findSicbo?.sic) || 0,
          Number(findSicbo?.bo) || 0,
          results,
          Number(findSicbo.endAt),
        );
        const dataMsg = {
          sender_id: authId,
          clan_id: clanId,
          mode: mode,
          is_public: isPublicBoolean,
          color: color,
          clan_nick: authorName,
          username: authorName,
        };
        const components = this.generateButtonComponents(dataMsg);
        await messsage.update({ embed: resultEmbed, components });
      }
    } catch (error) {}
  }
}
