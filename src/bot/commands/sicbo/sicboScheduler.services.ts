import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { EMessageComponentType, MezonClient } from 'mezon-sdk';
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
    const sicboItems = [
      '25.png',
      '26.png',
      '27.png',
      '1.png',
      '28.png',
      '29.png',
    ];
    const findSicbo = await this.sicboRepository.findOne({
      where: { deleted: false },
    });
    const channelIds = findSicbo?.channelId;
    if (!findSicbo) return;
    const sic = Number(findSicbo.sic || 0);
    const bo = Number(findSicbo.bo || 0);
    const rolls: number[] = [];
    const results: string[][] = [];
    let number = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      number[i] = Math.floor(Math.random() * sicboItems.length);
      const result = [...sicboItems, sicboItems[number[i]]];
      results.push(result);
      rolls.push(number[i] + 1);
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
        reward = Math.floor(
          Number(user.sic) * rewardRate * 0.9 + Number(user.sic),
        );
      }
      if (resultBet === 2) {
        reward = Math.floor(
          Number(user.bo) * rewardRate * 0.9 + Number(user.bo),
        );
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
    const embed = [
      {
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
                  'https://cdn.mezon.ai/0/1840682626818510848/1779513150169682000/1747814491095_0spritesheet__7_.png',
                url_position:
                  'https://cdn.mezon.ai/0/1840682626818510848/1779513150169682000/1747814483360_0spritesheet__8_.json',
                isResult: 1,
                pool: results,
                repeat: 3,
                duration: 1,
              },
            },
          },
        ],
      },
    ];
    if (findSicbo?.message.length > 0) {
      for (const message of findSicbo?.message) {
        const channel = await this.client.channels.fetch(message.channel_id);
        const msg = await channel?.messages.fetch(message.id);
        msg?.update({ embed });
      }
    }
    if (channelIds) {
      for (const channelId of channelIds) {
        const channel = await this.client.channels.fetch(channelId);
        const msgBot = await channel.send({ embed });
        if (!msgBot) {
          return;
        }
      }
    }
  }
}
