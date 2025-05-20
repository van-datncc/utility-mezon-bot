import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { ChannelMessage, EMessageComponentType, MezonClient } from 'mezon-sdk';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { Sicbo } from 'src/bot/models/sicbo.entity';
import { User } from 'src/bot/models/user.entity';
import { UserSicbo } from 'src/bot/models/user.sicbo.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { Repository } from 'typeorm';
import { SicboService } from './sicbo.service';
import { getRandomColor } from 'src/bot/utils/helps';

@Injectable()
export class SicboSchedulerService {
  private client: MezonClient;
  constructor(
    @InjectRepository(UserSicbo)
    private userSicboRepository: Repository<UserSicbo>,
    @InjectRepository(Sicbo) private sicboRepository: Repository<Sicbo>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private clientService: MezonClientService,
    private sicboService: SicboService,
  ) {
    this.client = this.clientService.getClient();
    this.startCronJobs();
  }

  startCronJobs(): void {
    console.log('startCronJobs');

    const job = new CronJob(
      '*/1 * * * *',
      () => {
        this.checkSicboEnd();
      },
      null,
      true,
      'Asia/Ho_Chi_Minh',
    );

    job.start();
  }

  async checkSicboEnd() {
    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });

    if (!findSicbo) return;

    const endAt = Number(findSicbo.endAt);

    if (endAt && new Date(endAt) < new Date()) {
      this.sicboEnd();
    }
  }

  async sicboEnd() {
    const sicboItems = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png'];
    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });
    const channelIds = findSicbo?.channelId;
    if (!findSicbo) return;
    const sic = Number(findSicbo.sic || 0);
    const bo = Number(findSicbo.bo || 0);
    const rolls: number[] = [];
    const results: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * 6);
      const value = parseInt(sicboItems[randomIndex]);
      const result = [...sicboItems, sicboItems[randomIndex]];
      results.push(result);
      rolls.push(value);
    }

    const total = rolls.reduce((sum, val) => sum + val, 0);
    const resultBet = total <= 10 ? 2 : 1;
    let rewardRate = 0;
    if (resultBet === 1) {
      if (sic === 0) {
        rewardRate = 0;
      } else {
        rewardRate = Number(bo / sic);
      }
    } else if (resultBet === 2) {
      if (bo === 0) {
        rewardRate = 0;
      } else {
        rewardRate = Number(sic / bo);
        console.log('rewardRate: ', rewardRate);
      }
    }
    findSicbo.deleted = true;
    findSicbo.result = resultBet;
    await this.sicboRepository.save(findSicbo);
    const userBets = await this.userSicboRepository.find({
      where: { sicboId: findSicbo.id.toString() },
    });
    //todo: lấy tròn xuống rewardRate
    // todo: căt phần trăm về nhà cái
    for (const user of userBets) {
      let reward = 0;
      if (resultBet === 1) {
        reward = Math.floor(Number(user.sic) * rewardRate * 0.9 + Number(user.sic));
      }
      if (resultBet === 2) {
        reward = Math.floor(Number(user.bo) * rewardRate * 0.9 + Number(user.bo));
      }
      await this.userSicboRepository.update(
        { userId: user.userId, sicboId: findSicbo.id.toString() },
        { result: reward },
      );
      if (reward > 0) {
        const findUser = await this.userRepository.findOne({
          where: { user_id: user.userId },
        });

        if (findUser) {
          findUser.amount = Number(findUser.amount || 0) + reward;

          await this.userRepository.save(findUser);
        }
      }
    }
    if (channelIds) {
      for (const channelId of channelIds) {
        const channel = await this.client.channels.fetch(channelId);
        const embed = [
          {
            color: getRandomColor(),
            title: `🎲 Sicbo 🎲`,
            fields: [
              {
                name: '',
                value: '',
                inputs: {
                  id: `slots`,
                  type: EMessageComponentType.ANIMATION,
                  component: {
                    url_image:
                      'https://cdn.mezon.ai/1840678035754323968/1840678035775295488/1779513150169682000/1747215061507_0spritesheet__2_.png',
                    url_position:
                      'https://cdn.mezon.ai/1840678035754323968/1840678035775295488/1779513150169682000/1747215057985_0spritesheet__3_.json',
                    pool: results,
                    repeat: 6,
                    duration: 0.5,
                  },
                },
              },
            ],
          },
        ];
        const msgBot = await channel.send({ embed });
        if (!msgBot) {
          return;
        }
        const msg: ChannelMessage = {
          mode: msgBot.mode,
          message_id: msgBot.message_id,
          code: msgBot.code,
          create_time: msgBot.create_time,
          update_time: msgBot.update_time,
          id: msgBot.message_id,
          clan_id: channel.clan.id,
          channel_id: msgBot.channel_id,
          persistent: msgBot.persistence,
          channel_label: channel.name || '',
          content: {},
          sender_id: process.env.UTILITY_BOT_ID as string,
        };
        const messageBot = await channel?.messages.fetch(msgBot.message_id!);
        
        setTimeout(() => {
          const msgResults = {
            color: getRandomColor(),
            title: `🎲 Kết quả Sicbo ${resultBet === 1 ? 'tài' : 'xỉu'} thắng🎲`,
            
            fields: [
              {
                name: '',
                value: '',
                inputs: {
                  id: `slots`,
                  type: EMessageComponentType.ANIMATION,
                  component: {
                    url_image:
                      'https://cdn.mezon.ai/1840678035754323968/1840678035775295488/1779513150169682000/1747215061507_0spritesheet__2_.png',
                    url_position:
                      'https://cdn.mezon.ai/1840678035754323968/1840678035775295488/1779513150169682000/1747215057985_0spritesheet__3_.json',
                    isResult: 1,
                    pool: results,
                    repeat: 6,
                    duration: 0.5,
                  },
                },
              },
            ],
          };
          messageBot?.update({ embed: [msgResults] });
        }, 4000);
      }
    }
  }
}
