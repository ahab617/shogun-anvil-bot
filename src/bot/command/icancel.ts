import { bot } from "../index";
import userList from "../../controller/userList";
import config from "../../config.json";
const { Commands } = require("../index.ts");
const { removeAnswerCallback, sendMessage } = require("../library/index");

export default new Commands(
  new RegExp(/^\/cancel/),
  "Cancel Bot",
  "cancel",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
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
        `No permission. Please contact to the support team.`
      );
      return;
    }

    await removeAnswerCallback(msg.chat);
    await sendMessage(
      msg.chat.id,
      `<b>All active commands have been canceled.</b>`
    );
  }
);
