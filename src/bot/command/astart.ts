import { startHandler } from "../library/startHandler";
import { bot } from "../index";
const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/start/),
  "Start Bot",
  "start",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      await bot.sendMessage(msg.chat.id, `No permission`, {});
      return;
    }
    await startHandler(msg);
  }
);
