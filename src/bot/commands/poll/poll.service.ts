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
import {
  EmbebButtonType,
  EmbedProps,
  MEZON_EMBED_FOOTER,
} from 'src/bot/constants/configs';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { getRandomColor, sleep } from 'src/bot/utils/helps';

@Injectable()
export class PollService {
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

  private iconList = [
    '1️⃣ ',
    '2️⃣ ',
    '3️⃣ ',
    '4️⃣ ',
    '5️⃣ ',
    '6️⃣ ',
    '7️⃣ ',
    '8️⃣ ',
    '9️⃣ ',
    '🔟 ',
  ];

  getOptionPoll(pollString: string) {
    let option;
    const regex = /\d️⃣:\s*(.*)/g;
    const options: any[] = [];
    while ((option = regex.exec(pollString)) !== null) {
      options.push(option[1].trim());
    }

    return options;
  }

  getPollTitle(pollString: string) {
    let pollTitle;
    const match = pollString.toString().match(/\[Poll\] - (.*)\n/);
    if (match && match[1]) {
      pollTitle = match[1];
    }

    return pollTitle;
  }

  generateEmbedComponents(options, data?) {
    const embedCompoents = options.map((option, index) => {
      const userVoted = data?.[index];
      return {
        label: `${this.iconList[index] + option.trim()} ${userVoted?.length ? `(${userVoted?.length})` : ''}`,
        value: `poll_${index}`,
        description: `${userVoted ? `- Voted: ${userVoted.join(', ')}` : `- (no one choose)`}`,
        style: EButtonMessageStyle.SUCCESS,
      };
    });
    return embedCompoents;
  }

  generateEmbedMessage(
    title: string,
    authorName: string,
    color: string,
    embedCompoents,
  ) {
    return [
      {
        color,
        title: `[Poll] - ${title}`,
        description:
          'Select option you want to vote.\nThe voting will end in 7 days.\nPoll creater can end the poll forcefully by click Finish button.',
        fields: [
          {
            name: '',
            value: '',
            inputs: {
              id: `POLL`,
              type: EMessageComponentType.RADIO,
              component: embedCompoents,
            },
          },
          {
            name: `\nPoll created by ${authorName}\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t`,
            value: '',
          },
        ],
        timestamp: new Date().toISOString(),
        footer: MEZON_EMBED_FOOTER,
      },
    ];
  }

  generateEmbedComponentsResult(options, data, authorName: string) {
    const embedCompoents = options.map((option, index) => {
      const userVoted = data?.[index];
      return {
        name: `${this.iconList[index] + option.trim()} (${userVoted?.length || 0})`,
        value: `${userVoted ? `- Voted: ${userVoted.join(', ')}` : `- (no one choose)`}`,
      };
    });
    authorName &&
      embedCompoents.push({
        name: `\nPoll created by ${authorName}\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t`,
        value: '',
      });
    return embedCompoents;
  }

  generateEmbedMessageResult(title: string, color: string, embedCompoents) {
    return [
      {
        color,
        title: `[Poll result] - ${title}`,
        description: "Ding! Ding! Ding!\nTime's up! Results are\n",
        fields: embedCompoents,
        timestamp: new Date().toISOString(),
        footer: MEZON_EMBED_FOOTER,
      },
    ];
  }

  generateButtonComponents(data) {
    return [
      {
        components: [
          {
            id: `poll_CANCEL_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `poll_VOTE_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Vote`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
          {
            id: `poll_FINISH_${data.sender_id}_${data.clan_id}_${data.mode}_${data.is_public}_${data?.color}_${data.clan_nick || data.username}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Finish`,
              style: EButtonMessageStyle.DANGER,
            },
          },
        ],
      },
    ];
  }

  // TODO: split text
  // splitMessageByNewLines(message, maxNewLinesPerChunk = 100) {
  //   const lines = message.split('\n');
  //   const chunks = [];
  //   for (let i = 0; i < lines.length; i += maxNewLinesPerChunk) {
  //     chunks.push(lines.slice(i, i + maxNewLinesPerChunk).join('\n'));
  //   }
  //   return chunks;
  // };

  async handleResultPoll(findMessagePoll: MezonBotMessage) {
    try {
      let userVoteMessageId =
        findMessagePoll.pollResult?.map((item) => JSON.parse(item)) || [];
      const content = findMessagePoll.content.split('_');
      const [title, ...options] = content;

      const findUser = await this.userRepository.findOne({
        where: { user_id: findMessagePoll.userId },
      });

      const groupedByValue: { [key: string]: any[] } = userVoteMessageId.reduce(
        (acc: any, item) => {
          const { value } = item;
          if (!acc[value]) {
            acc[value] = [];
          }
          acc[value].push(item.username);
          return acc;
        },
        {},
      );
      const embedCompoents = this.generateEmbedComponentsResult(
        options,
        groupedByValue,
        findUser?.clan_nick || findUser?.username!,
      );
      const embed: EmbedProps[] = this.generateEmbedMessageResult(
        title,
        getRandomColor(),
        embedCompoents,
      );

      await this.mezonBotMessageRepository.update(
        {
          id: findMessagePoll.id,
        },
        { deleted: true },
      );
      const findChannel = await this.client.channels.fetch(
        findMessagePoll.channelId,
      );
      await findChannel.send({
        embed,
      });
      const textConfirm = 'This poll has finished!';
      const msgFinish = {
        t: textConfirm,
        mk: [{ type: EMarkdownType.PRE, s: 0, e: textConfirm.length }],
      };
      const channel = await this.client.channels.fetch(
        findMessagePoll.channelId,
      );
      if (!channel) return;
      const pollMessage = await channel.messages.fetch(
        findMessagePoll.messageId,
      );
      if (!pollMessage) return;
      await pollMessage.update(msgFinish);
    } catch (error) {
      console.log('handleResultPoll', error);
    }
  }

  async handleSelectPoll(data) {
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
      ] = data.button_id.split('_');
      const channel = await this.client.channels.fetch(data.channel_id);
      const user = await channel.clan.users.fetch(data.user_id);
      const messsage = await channel.messages.fetch(data.message_id);

      const isPublicBoolean = isPublic === 'true' ? true : false;
      const findMessagePoll = await this.mezonBotMessageRepository.findOne({
        where: {
          messageId: data.message_id,
          channelId: data.channel_id,
          deleted: false,
        },
      });
      if (!findMessagePoll) return;
      let userVoteMessageId =
        findMessagePoll.pollResult?.map((item) => JSON.parse(item)) || [];
      const content = findMessagePoll.content.split('_');
      const [title, ...options] = content;
      const dataParse = JSON.parse(data.extra_data || '{}');
      const value = dataParse?.POLL?.[0].split('_')?.[1];

      if (typeButtonRes === EmbebButtonType.CANCEL) {
        if (data.user_id !== authId) {
          const content = `[Poll] - ${title}\n❌You have no permission to cancel this poll!`;
          return await user.sendDM({
            t: content,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: content.length }],
          });
        }
        const textCancel = 'Cancel poll successful!';
        const msgCancel = {
          t: textCancel,
          mk: [{ type: EMarkdownType.PRE, s: 0, e: textCancel.length }],
        };
        await this.mezonBotMessageRepository.update(
          {
            id: findMessagePoll.id,
          },
          { deleted: true },
        );
        await messsage.update(msgCancel);
      }
      if (typeButtonRes === EmbebButtonType.VOTE) {
        const findUser = await this.userRepository.findOne({
          where: { user_id: data.user_id },
        });
        const newUserVoteMessage = {
          username: findUser?.clan_nick || findUser?.username,
          value,
        };
        const exists = userVoteMessageId.some(
          (item) =>
            item.username === newUserVoteMessage.username &&
            item.value === newUserVoteMessage.value,
        );
        if (exists) return;
        let checkExist = false;
        if (userVoteMessageId.length) {
          userVoteMessageId = userVoteMessageId.map((user) => {
            if (user.username === (findUser?.clan_nick || findUser?.username)) {
              checkExist = true;
              return { ...user, value }; // update new user option
            }
            return user;
          });
        }
        if (!checkExist) {
          userVoteMessageId.push(newUserVoteMessage);
        }

        // group username by value
        const groupedByValue: { [key: string]: any[] } =
          userVoteMessageId.reduce((acc: any, item) => {
            const { value } = item;
            if (!acc[value]) {
              acc[value] = [];
            }
            acc[value].push(item.username);
            return acc;
          }, {});

        // display user + value on embed
        const embedCompoents = this.generateEmbedComponents(
          options,
          groupedByValue,
        );

        // embed poll
        const embed: EmbedProps[] = this.generateEmbedMessage(
          title,
          authorName,
          color,
          embedCompoents,
        );
        const dataGenerateButtonComponents = {
          sender_id: authId,
          clan_id: clanId,
          mode,
          is_public: isPublicBoolean,
          color,
          username: authorName,
        };

        // button embed poll
        const components = this.generateButtonComponents(
          dataGenerateButtonComponents,
        );

        // update voted into db
        await this.mezonBotMessageRepository.update(
          {
            messageId: findMessagePoll.messageId,
            channelId: findMessagePoll.channelId,
          },
          { pollResult: userVoteMessageId },
        );

        // update message
        await messsage.update({ embed, components });
      }

      if (typeButtonRes === EmbebButtonType.FINISH) {
        if (data.user_id !== authId) {
          const content = `[Poll] - ${title}\n❌You have no permission to finish this poll!`;
          return await user.sendDM({
            t: content,
            mk: [{ type: EMarkdownType.PRE, s: 0, e: content.length }],
          });
        }
        this.blockEditedList.push(`${data.message_id}-${data.channel_id}`);
        await sleep(700);
        await this.handleResultPoll(findMessagePoll);
      }
    } catch (error) {}
  }
}
