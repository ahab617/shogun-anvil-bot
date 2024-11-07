import { adminStartHandler } from "../library/adminStartHandler";
import config from "../../config.json";
import adminListController from "../../controller/adminList";
import { bot } from "../index";
const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/manage/),
  "Manage Bot",
  "manage",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      bot.sendMessage(msg.chat.id, `No permission`, {});
      return;
    }
    const adminList = await adminListController.find();
    if (
      msg.chat.id == config.SUPER_ADMIN_ID ||
      adminList?.filter((item: any) => item.userId == msg.chat.id).length > 0
    ) {
      adminStartHandler(msg);
    } else {
      bot.sendMessage(msg.chat.id, `You aren't admin `, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      });
    }
  }
);
