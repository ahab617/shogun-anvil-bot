import { bot } from "../index";
import config from "../../config.json";
import userListController from "../../controller/userList";
import adminListController from "../../controller/adminList";

const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/removepermission/),
  "Start Bot",
  "removepermission",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      bot.sendMessage(msg.chat.id, `This command can only be used in DM.`, {});
      return;
    }

    const adminList = await adminListController.find();
    if (
      msg.chat.id == config.SUPER_ADMIN_ID ||
      adminList?.filter((item: any) => item.userId == msg.chat.id).length > 0
    ) {
      const text = msg.text;
      const userId = text.replace(/^\/removepermission/, "").trim() || "0";
      if (!Number.isInteger(Number(userId))) {
        bot.sendMessage(msg.chat.id, `Please enter the valid user ID.`);
      } else {
        const result = await userListController.updateOne({
          userId: Number(userId),
          permission: false,
        });
        bot.sendMessage(msg.chat.id, result?.msg, {});
      }
    } else {
      bot.sendMessage(msg.chat.id, `No permission`, {});
    }
  }
);
