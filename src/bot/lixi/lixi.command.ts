import {
  ChannelMessage,
  EButtonMessageStyle,
  EMarkdownType,
  EMessageComponentType,
} from 'mezon-sdk';
import { Command } from 'src/bot/base/commandRegister.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandMessage } from 'src/bot/base/command.abstract';
import { MezonBotMessage } from 'src/bot/models/mezonBotMessage.entity';
import { getRandomColor } from 'src/bot/utils/helps';
import { MezonClientService } from 'src/mezon/services/mezon-client.service';
import { User } from '../models/user.entity';
import { EUserError } from '../constants/error';
import { EmbedProps, FuncType, MEZON_EMBED_FOOTER } from '../constants/configs';

interface UserSummary {
  given: number;
  received: number;
  username?: string;
  receivedCount: number;
  givenCount: number;
}

interface LixiRecipient {
  amount: number;
  userId?: string;
  user_id?: string;
  username: string;
}

@Command('lixi')
export class LixiCommand extends CommandMessage {
  constructor(
    clientService: MezonClientService,
    @InjectRepository(MezonBotMessage)
    private mezonBotMessageRepository: Repository<MezonBotMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super(clientService);
  }

  async execute1(args: string[], message: ChannelMessage) {
    const messageChannel = await this.getChannelMessage(message);
    const msgText = `❌ Command Lixi hiện đang bảo trì!`;
    return await messageChannel?.reply({
      t: msgText,
      mk: [
        {
          type: EMarkdownType.PRE,
          s: 0,
          e: msgText.length,
        },
      ],
    });
  }

  // Format date with Vietnamese locale
  private formatDate(timestamp: number): string {
    // Ensure we're working with milliseconds
    const timestampMs =
      timestamp.toString().length === 13 ? timestamp : timestamp * 1000;
    const date = new Date(timestampMs);
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // Handle lixi detail command - shows details of recent lixi transactions
  async handleLixiDetail(messageChannel: any) {
    try {
      const lixiMessages = await this.mezonBotMessageRepository
        .createQueryBuilder('entity')
        .where('entity.lixiResult IS NOT NULL')
        .andWhere("entity.lixiResult != '[]'::jsonb")
        .orderBy('entity.createAt', 'DESC')
        .limit(10)
        .getMany();

      if (!lixiMessages || lixiMessages.length === 0) {
        const noLixiMsg = 'Không tìm thấy dữ liệu lixi nào.';
        return await messageChannel?.reply({
          t: noLixiMsg,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: noLixiMsg.length,
            },
          ],
        });
      }

      let responseText = '';

      for (const msg of lixiMessages) {
        if (Array.isArray(msg.lixiResult) && msg.lixiResult.length > 0) {
          const recipients = msg.lixiResult[2] || [];

          if (Array.isArray(recipients) && recipients.length > 0) {
            const createDate = msg.createAt
              ? this.formatDate(Number(msg.createAt))
              : 'Unknown';

            let creatorUsername = 'Unknown';
            if (msg.userId) {
              try {
                const creator = await this.userRepository.findOne({
                  where: { user_id: msg.userId },
                });
                if (creator) {
                  creatorUsername =
                    creator.username || creator.clan_nick || 'Unknown';
                }
              } catch (err) {
                console.error('Error fetching creator info:', err);
              }
            }

            const calculatedTotal = recipients.reduce(
              (sum, recipient) => sum + (recipient.amount || 0),
              0,
            );

            responseText += `👤 Người tạo: ${creatorUsername} (${createDate})\n`;
            responseText += `💰 Tổng số tiền: ${this.formatAmount(calculatedTotal)}\n`;
            responseText += `👥 Người nhận (${recipients.length}):\n`;

            recipients.forEach((recipient: LixiRecipient, index) => {
              const userId = recipient.user_id || 'Unknown';
              const username = recipient.username || 'Unknown';
              const amount = recipient.amount || 0;

              responseText += ` ${index + 1}. ${username} : ${this.formatAmount(amount)}\n`;
            });

            responseText += '\n';
          }
        }
      }

      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `📊 THÔNG TIN NGƯỜI NHẬN LIXI:`,
          description: '```' + responseText + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];

      console.log('responseText', responseText);

      return await messageChannel?.reply({ embed });
    } catch (error) {
      console.error('Error in lixi detail query:', error);

      try {
        const basicCheck = await this.mezonBotMessageRepository
          .createQueryBuilder('entity')
          .limit(1)
          .getMany();
      } catch (basicError) {
        console.error('Basic query also failed:', basicError);
      }

      const errorMsg =
        'Đã xảy ra lỗi khi truy vấn dữ liệu lixi. Vui lòng thử lại sau.';
      return await messageChannel?.reply({
        t: errorMsg,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: errorMsg.length,
          },
        ],
      });
    }
  }

  // Handle lixi check command - shows overall statistics
  async handleLixiCheck(messageChannel: any) {
    try {
      const lixiMessages = await this.mezonBotMessageRepository
        .createQueryBuilder('entity')
        .where('entity.content IS NOT NULL')
        .andWhere("entity.lixiResult != '[]'::jsonb")
        .getMany();

      if (!lixiMessages || lixiMessages.length === 0) {
        const noLixiMsg = 'Không tìm thấy dữ liệu lixi nào.';
        return await messageChannel?.reply({
          t: noLixiMsg,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: noLixiMsg.length,
            },
          ],
        });
      }

      let totalLixiCreated = 0;
      let totalAmountGiven = 0;
      let uniqueCreators = new Set();
      let uniqueRecipients = new Set();
      let totalRecipientCount = 0;

      for (const msg of lixiMessages) {
        if (Array.isArray(msg.lixiResult) && msg.lixiResult.length > 0) {
          const recipients = msg.lixiResult[2] || [];

          totalLixiCreated++;

          if (msg.userId) {
            uniqueCreators.add(msg.userId);
          }

          if (Array.isArray(recipients)) {
            const lixiAmount = recipients.reduce(
              (sum, recipient) => sum + (recipient.amount || 0),
              0,
            );

            totalAmountGiven += lixiAmount;
            totalRecipientCount += recipients.length;

            recipients.forEach((recipient) => {
              if (recipient.user_id) {
                uniqueRecipients.add(recipient.user_id);
              }
            });
          }
        }
      }

      let responseText = '📊 Thống kê Lixi tổng quan:\n\n';
      responseText += `🧧 Tổng số lixi đã tạo: ${totalLixiCreated}\n`;
      responseText += `💰 Tổng số tiền đã phát: ${this.formatAmount(totalAmountGiven)}\n`;
      responseText += `💸 Tổng số tiền nhận: ${this.formatAmount(totalAmountGiven)}\n`;
      responseText += `👤 Số người tạo lixi: ${uniqueCreators.size}\n`;
      responseText += `👥 Số người nhận lixi: ${uniqueRecipients.size}\n`;
      responseText += `📝 Tổng số lượt nhận: ${totalRecipientCount}\n`;

      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `📊 THỐNG KÊ LIXI TỔNG QUAN`,
          description: '```' + responseText + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];

      return await messageChannel?.reply({ embed });
    } catch (error) {
      console.error('Error in lixi check summary:', error);

      const errorMsg =
        'Đã xảy ra lỗi khi tạo thống kê lixi. Vui lòng thử lại sau.';
      return await messageChannel?.reply({
        t: errorMsg,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: errorMsg.length,
          },
        ],
      });
    }
  }

  // Handle lixi top command - shows top N givers and receivers
  async handleLixiTop(messageChannel: any, limit: number) {
    try {
      const lixiMessages = await this.mezonBotMessageRepository
        .createQueryBuilder('entity')
        .where('entity.content IS NOT NULL')
        .andWhere("entity.lixiResult != '[]'::jsonb")
        .getMany();

      if (!lixiMessages || lixiMessages.length === 0) {
        const noLixiMsg = 'Không tìm thấy dữ liệu lixi nào.';
        return await messageChannel?.reply({
          t: noLixiMsg,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: noLixiMsg.length,
            },
          ],
        });
      }

      const userSummary: Record<string, UserSummary> = {};

      for (const msg of lixiMessages) {
        if (Array.isArray(msg.lixiResult) && msg.lixiResult.length > 0) {
          const recipients = msg.lixiResult[2] || [];

          if (msg.userId) {
            if (!userSummary[msg.userId]) {
              userSummary[msg.userId] = {
                given: 0,
                received: 0,
                receivedCount: 0,
                givenCount: 0,
              };
            }

            const totalGiven = recipients.reduce(
              (sum, recipient) => sum + (recipient.amount || 0),
              0,
            );

            userSummary[msg.userId].given += totalGiven;
            userSummary[msg.userId].givenCount++;
          }

          if (Array.isArray(recipients)) {
            recipients.forEach((recipient) => {
              if (recipient.user_id) {
                if (!userSummary[recipient.user_id]) {
                  userSummary[recipient.user_id] = {
                    given: 0,
                    received: 0,
                    receivedCount: 0,
                    givenCount: 0,
                  };
                }
                userSummary[recipient.user_id].received +=
                  recipient.amount || 0;
                userSummary[recipient.user_id].receivedCount++;

                if (
                  recipient.username &&
                  !userSummary[recipient.user_id].username
                ) {
                  userSummary[recipient.user_id].username = recipient.username;
                }
              }
            });
          }
        }
      }

      const userIds = Object.keys(userSummary).filter(
        (id) => !userSummary[id].username,
      );
      if (userIds.length > 0) {
        const users = await this.userRepository.find({
          where: userIds.map((id) => ({ user_id: id })),
        });

        users.forEach((user) => {
          if (userSummary[user.user_id]) {
            userSummary[user.user_id].username =
              user.username || user.clan_nick || 'Unknown';
          }
        });
      }

      const topGivers = Object.entries(userSummary)
        .map(([userId, data]) => ({
          userId,
          username: data.username || 'Unknown',
          amount: data.given,
          givenCount: data.givenCount,
        }))
        .filter((user) => user.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

      const topReceivers = Object.entries(userSummary)
        .map(([userId, data]) => ({
          userId,
          username: data.username || 'Unknown',
          amount: data.received,
          receivedCount: data.receivedCount,
        }))
        .filter((user) => user.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

      let responseText = '';

      responseText += `💸 Top ${limit} người tặng lixi nhiều nhất:\n`;
      topGivers.forEach((user, index) => {
        responseText += `${index + 1}. ${user.username}: ${this.formatAmount(user.amount)} (${user.givenCount} lần)\n`;
      });

      responseText += `\n🧧 Top ${limit} người nhận lixi nhiều nhất:\n`;
      topReceivers.forEach((user, index) => {
        responseText += `${index + 1}. ${user.username}: ${this.formatAmount(user.amount)} (${user.receivedCount} lần)\n`;
      });

      responseText += `\n\n[Lixi] không tính khi người dùng cancel lixi khi không có người nhận`;

      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `🏆 TOP ${limit} LIXI`,
          description: '```' + responseText + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];

      return await messageChannel?.reply({ embed });
    } catch (error) {
      console.error(`Error in lixi top${limit}:`, error);

      const errorMsg = `Đã xảy ra lỗi khi tạo top ${limit} lixi. Vui lòng thử lại sau.`;
      return await messageChannel?.reply({
        t: errorMsg,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: errorMsg.length,
          },
        ],
      });
    }
  }

  // Handle lixi check for a specific user
  async handleUserLixiCheck(messageChannel: any, username: string) {
    try {
      const lixiMessages = await this.mezonBotMessageRepository
        .createQueryBuilder('entity')
        .where('entity.content IS NOT NULL')
        .andWhere("entity.lixiResult != '[]'::jsonb")
        .getMany();

      if (!lixiMessages || lixiMessages.length === 0) {
        const noLixiMsg = 'Không tìm thấy dữ liệu lixi nào.';
        return await messageChannel?.reply({
          t: noLixiMsg,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: noLixiMsg.length,
            },
          ],
        });
      }

      // Find the user by username
      const user = await this.userRepository.findOne({
        where: { username },
      });

      if (!user) {
        const notFoundMsg = `Không tìm thấy người dùng với tên "${username}".`;
        return await messageChannel?.reply({
          t: notFoundMsg,
          mk: [
            {
              type: EMarkdownType.PRE,
              s: 0,
              e: notFoundMsg.length,
            },
          ],
        });
      }

      const userId = user.user_id;
      let totalGiven = 0;
      let totalReceived = 0;
      let lixiCreated = 0;
      let lixiReceived = 0;

      // Process all lixi messages
      for (const msg of lixiMessages) {
        if (Array.isArray(msg.lixiResult) && msg.lixiResult.length > 0) {
          const recipients = msg.lixiResult[2] || [];

          // Check if this user created this lixi
          if (msg.userId === userId) {
            lixiCreated++;

            // Sum all recipient amounts for this lixi
            const lixiAmount = recipients.reduce(
              (sum, recipient) => sum + (recipient.amount || 0),
              0,
            );

            totalGiven += lixiAmount;
          }

          // Check if this user received from this lixi
          if (Array.isArray(recipients)) {
            recipients.forEach((recipient) => {
              if (recipient.user_id === userId) {
                lixiReceived++;
                totalReceived += recipient.amount || 0;
              }
            });
          }
        }
      }

      // Generate response
      let responseText = `📊 Thống kê Lixi của người dùng ${username}:\n\n`;
      responseText += `💸 Đã tặng Lixi: ${this.formatAmount(totalGiven)} (${lixiCreated} lần)\n`;
      responseText += `🧧 Đã nhận Lixi: ${this.formatAmount(totalReceived)} (${lixiReceived} lần)\n`;

      const embed: EmbedProps[] = [
        {
          color: getRandomColor(),
          title: `📊 THỐNG KÊ LIXI CỦA ${username.toUpperCase()}`,
          description: '```' + responseText + '```',
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Powered by Mezon',
            icon_url:
              'https://cdn.mezon.vn/1837043892743049216/1840654271217930240/1827994776956309500/857_0246x0w.webp',
          },
        },
      ];

      return await messageChannel?.reply({ embed });
    } catch (error) {
      console.error('Error in user lixi check:', error);

      const errorMsg =
        'Đã xảy ra lỗi khi tạo thống kê lixi cho người dùng. Vui lòng thử lại sau.';
      return await messageChannel?.reply({
        t: errorMsg,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: errorMsg.length,
          },
        ],
      });
    }
  }

  async execute(args: string[], message: ChannelMessage) {
    console.log('ag', args);
    const messageChannel = await this.getChannelMessage(message);
    if (message.username === 'Anonymous') {
      const content = `[Lixi] Anonymous can't use this command!`;

      return await messageChannel?.reply({
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

    const findUser = await this.userRepository.findOne({
      where: { user_id: message.sender_id },
    });
    if (!findUser) {
      return await messageChannel?.reply({
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

    const activeBan = Array.isArray(findUser.ban)
      ? findUser.ban.find(
          (ban) =>
            (ban.type === FuncType.LIXI || ban.type === FuncType.ALL) &&
            ban.unBanTime > Math.floor(Date.now() / 1000),
        )
      : null;

    if (activeBan) {
      const unbanDate = new Date(activeBan.unBanTime * 1000);
      const formattedTime = unbanDate.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
      });
      const content = activeBan.note;

      const msgText = `❌ Bạn đang bị cấm thực hiện hành động "lixi" đến ${formattedTime}\n   - Lý do: ${content}\n NOTE: Hãy liên hệ admin để mua vé unban`;
      return await messageChannel?.reply({
        t: msgText,
        mk: [
          {
            type: EMarkdownType.PRE,
            s: 0,
            e: msgText.length,
          },
        ],
      });
    }

    if (args[0] === 'detail') {
      return await this.handleLixiDetail(messageChannel);
    }

    if (args[0] === 'check') {
      if (args[1]) {
        const username = args[1];
        return await this.handleUserLixiCheck(messageChannel, username);
      }
      return await this.handleLixiCheck(messageChannel);
    }

    if (args[0] === 'top5') {
      return await this.handleLixiTop(messageChannel, 5);
    }

    if (args[0] === 'top10') {
      return await this.handleLixiTop(messageChannel, 10);
    }

    const messageid = message.message_id;

    const onlyLixiSyntax =
      message?.content?.t && typeof message.content.t === 'string'
        ? message.content.t.trim() === '*lixi'
        : false;

    const embed: EmbedProps[] = [
      {
        color: getRandomColor(),
        title: `[Lixi]`,
        fields: [
          {
            name: 'description:',
            value: '',
            inputs: {
              id: `lixi-${messageid}-description-ip`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `lixi-${messageid}-description-plhder`,
                placeholder: 'Ex. Write something',
                required: true,
                textarea: true,
              },
            },
          },
          {
            name: 'TotalAmount:',
            value: '',
            inputs: {
              id: `lixi-${messageid}-totalAmount-ip`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `lixi-${messageid}-totalAmount-plhder`,
                required: true,
                defaultValue: 10000,
                type: 'number',
              },
            },
          },
          {
            name: 'MinLixi:',
            value: '',
            inputs: {
              id: `lixi-${messageid}-minLixi-ip`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `lixi-${messageid}-minLixi-plhder`,
                required: true,
                defaultValue: 10000,
                type: 'number',
              },
            },
          },
          {
            name: 'NumLixi:',
            value: '',
            inputs: {
              id: `lixi-${messageid}-numLixi`,
              type: EMessageComponentType.INPUT,
              component: {
                id: `lixi-${messageid}-numLixi-plhder`,
                required: true,
                defaultValue: 1,
                type: 'number',
              },
            },
          },
        ],

        timestamp: new Date().toISOString(),
        footer: MEZON_EMBED_FOOTER,
      },
    ];
    const components = [
      {
        components: [
          {
            id: `lixi_CANCEL_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${0}_${0}_${messageid}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Cancel`,
              style: EButtonMessageStyle.SECONDARY,
            },
          },
          {
            id: `lixi_SUBMITCREATE_${message.sender_id}_${message.clan_id}_${message.mode}_${message.is_public}_${getRandomColor()}_${message.clan_nick || message.username}_${0}_${0}_${messageid}`,
            type: EMessageComponentType.BUTTON,
            component: {
              label: `Create`,
              style: EButtonMessageStyle.SUCCESS,
            },
          },
        ],
      },
    ];
    if (onlyLixiSyntax) {
      const messLixi = await messageChannel?.reply({
        embed,
        components,
      });
      if (!messLixi) return;
      const dataMezonBotMessage = {
        messageId: messLixi.message_id,
        userId: message.sender_id,
        clanId: message.clan_id,
        isChannelPublic: message.is_public,
        modeMessage: message.mode,
        channelId: message.channel_id,
        createAt: Date.now(),
        lixiResult: [[], 0, []],
      };
      await this.mezonBotMessageRepository.insert(dataMezonBotMessage);
      return;
    }
  }

  // Format amount with Vietnamese locale and đ symbol
  private formatAmount(amount: number): string {
    return `${amount.toLocaleString('vi-VN')} đ`;
  }
}
