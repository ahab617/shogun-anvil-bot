import { bot } from "../index";
import { showPrivateKey } from "../library/showPrivateKey";
import config from "../../config.json";
const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/showprivatekey/),
  "Show Privatekey",
  "showprivatekey",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      bot.sendMessage(msg.chat.id, `This command can only be used in DM.`, {});
      return;
    }
    if (msg.chat.id !== config.SUPER_ADMIN_ID) {
      bot.sendMessage(msg.chat.id, `No permission`, {});
      return;
    }
    showPrivateKey(msg);
  }
);
