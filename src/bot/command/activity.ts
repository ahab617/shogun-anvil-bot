import { swapHandler } from "../library/swapHandler";
import { bot } from "../index";
const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/activity/),
  "Activity bot",
  "activity",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      await bot.sendMessage(msg.chat.id, `No permission`, {});
      return;
    }
    await swapHandler(msg);
  }
);
