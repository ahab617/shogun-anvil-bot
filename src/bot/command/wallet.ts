import { bot } from "../index";
import config from "../../config.json";
import userList from "../../controller/userList";
import { walletHandler } from "../library/walletHandler";

const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/wallet/),
  "Wallet Bot",
  "wallet",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      bot.sendMessage(msg.chat.id, `This command can only be used in DM.`, {});
      return;
    }
    const userpermission = await userList.findOne({ userId: msg.chat.id });
    if (!userpermission?.permission) {
      bot.sendMessage(
        msg.chat.id,
        `No permission. Please check the below link.`,
        {
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Contact Us",
                  url: `${config.supportUrl}`,
                },
              ],
            ],
          },
        }
      );
      return;
    }
    walletHandler(msg);
  }
);
