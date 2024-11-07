import { bot } from "../index";
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
      bot.sendMessage(msg.chat.id, `No permission`, {});
      return;
    }
    removeAnswerCallback(msg.chat);
    await sendMessage(
      msg.chat.id,
      `<b>All active commands have been canceled.</b>`
    );
  }
);
