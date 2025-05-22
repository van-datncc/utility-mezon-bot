import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { PollService } from './poll.service';
import { CronJob } from 'cron';

@Injectable()
export class PollSchedulerService {
  constructor(
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    private pollService: PollService,
  ) {
    this.startCronJobs();
  }

  startCronJobs(): void {
      const job = new CronJob(
        '0 * * * *',
        () => {
          this.handleResultPollExpire();
        },
        null,
        true,
        'Asia/Ho_Chi_Minh',
      );
  
      job.start();
    }

  async handleResultPollExpire() {
    const currentTimestamp = Date.now();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const timestampMinus12Hours = new Date(+currentTimestamp - sevenDaysInMs);

    const findMessagePolls = await this.mezonBotMessageRepository.find({
      where: { createAt: LessThan(+timestampMinus12Hours), deleted: false, pollResult: Not(IsNull()) },
    });
    
    if (!findMessagePolls?.length) return;
    findMessagePolls.map((findMessagePoll) => {
      this.pollService.handleResultPoll(findMessagePoll);
    });
  }
}
