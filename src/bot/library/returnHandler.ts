import { bot } from "../index";
import { startHandler } from "./startHandler";

export const returnHandler = (msg: any) => {
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: msg.chat.id, message_id: msg.message_id }
  );
  startHandler(msg);
};
export const adminReturnHandler = (msg: any) => {
  startHandler(msg);
};
