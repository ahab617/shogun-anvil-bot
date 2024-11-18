import { tokenSettingHandler } from "../library/tokenSettingHandler";
import userList from "../../controller/userList";
import config from "../../config.json";
import { bot } from "../index";
const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/token/),
  "TokenSetting Bot",
  "token",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId !== chatId) {
      await bot.sendMessage(
        msg.chat.id,
        `This command can only be used in DM.`,
        {}
      );
      return;
    }

    const userpermission = await userList.findOne({ userId: msg.chat.id });
    if (!userpermission?.permission || chatId !== config.SUPER_ADMIN_ID) {
      await bot.sendMessage(
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

    await tokenSettingHandler(msg);
  }
);
