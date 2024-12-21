import path from "path";
import { bot } from "../index";
import config from "../../config.json";
import walletController from "../../controller/wallet";
import adminSetting from "../../controller/adminSetting";
import userListController from "../../controller/userList";
import tokenSettingController from "../../controller/tokenSetting";
import { removeAnswerCallback } from "./index";

interface TuserList {
  userId: number;
  userName: string;
}

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}
export const startHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    const result = await adminSetting.find();
    const data = result?.result as Array<TdepositData>;
    if (data?.length <= 0) {
      bot.sendMessage(
        msg.chat.id,
        `You have not been Whitelisted please contact Admin.`
      );
      return;
    }
    const userList = {
      userId: msg.chat.id,
      userName: msg.chat.username,
      permission: msg.chat.id === config.SUPER_ADMIN_ID ? true : false,
      fee: msg.chat.id === config.SUPER_ADMIN_ID ? 0 : data[0].fee,
    } as TuserList;
    const userCount = await userListController.create(userList);
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    const user1 = await tokenSettingController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    const videoPath = path.join(__dirname, "../../assets/AmariSilva.mp4");
    await bot
      .sendVideo(
        msg.chat.id,
        videoPath,
        {
          parse_mode: "HTML",
          duration: 45,
        },
        {
          contentType: "application/octet-stream",
          filename: "AmariSilva.mp4",
        }
      )
      .then(async () => {
    bot.sendMessage(
      msg.chat.id,
      `Welcome to <b>Anvil Bot!</b> (Total Users: ${Number(userCount)})
  
  Meet the Anvil Bot, Shogun’s foundation tool for growth. Like an anvil, it allows you to add
  material and swing the hammer, building the coin’s strength with each calculated trade.\n 
  Through strategic trade ratios, the bot empowers users to forge stability over time, supporting liquidity
  and enhancing value. Every trade reinforces the coin, turning market activity into a resilient structure.\n 
  With the Anvil Bot, you hold the power to shape the coin’s future with precision and control.
  
  <a href="${config.websiteUrl}">Anvil Bot Website</a> | <a href="${
        config.twitterUrl
      }">Twitter</a> | <a href="${
        config.telegramUrl
      }">Telegram</a> | <a href="${config.supportUrl}">Anvil Bot Guide</a>`,
      user
        ? user1
          ? {
              parse_mode: "HTML",
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🟢  Token Setting 💰",
                      callback_data: "token_setting",
                    },
                    {
                      text: "🟢  Open Wallet 🤖",
                      callback_data: "open_wallet",
                    },
                  ],
                  [
                    {
                      text: "Support",
                      url: `${config.supportUrl}`,
                    },
                    {
                      text: "Learn more 🔗",
                      url: `${config.supportUrl}`,
                    },
                  ],
                ],
              },
            }
          : {
              parse_mode: "HTML",
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🟠  Token Setting 💰",
                      callback_data: "token_setting",
                    },
                    {
                      text: "🟢  Open Wallet 🤖",
                      callback_data: "open_wallet",
                    },
                  ],
                  [
                    {
                      text: "Support",
                      url: `${config.supportUrl}`,
                    },
                    {
                      text: "Learn more 🔗",
                      url: `${config.supportUrl}`,
                    },
                  ],
                ],
              },
            }
        : user1
        ? {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🟢  Token Setting 💰",
                    callback_data: "token_setting",
                  },
                  {
                    text: "🟠  Open Wallet 🤖",
                    callback_data: "open_wallet",
                  },
                ],
                [
                  {
                    text: "Support",
                    url: `${config.supportUrl}`,
                  },
                  {
                    text: "Learn more 🔗",
                    url: `${config.supportUrl}`,
                  },
                ],
              ],
            },
          }
        : {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🟠  Token Setting 💰",
                    callback_data: "token_setting",
                  },
                  {
                    text: "🟠  Open Wallet 🤖",
                    callback_data: "open_wallet",
                  },
                ],
                [
                  {
                    text: "Support",
                    url: `${config.supportUrl}`,
                  },
                  {
                    text: "Learn more 🔗",
                    url: `${config.supportUrl}`,
                  },
                ],
              ],
            },
          }
    );
    });
  } catch (error) {
    console.log("startHandlerError: ", error);
  }
};
