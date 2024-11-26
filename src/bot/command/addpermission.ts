import { bot } from "../index";
import { addpermission } from "../library/addpermission";

const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/addpermission/),
  "Start Bot",
  "addpermission",
  true,
  async (msg: any) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    if (fromId != chatId) {
      bot.sendMessage(msg.chat.id, `This command can only be used in DM.`, {});
      return;
    }
    await addpermission(msg);
  }
);
