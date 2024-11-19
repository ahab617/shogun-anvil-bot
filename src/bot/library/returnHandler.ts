import { bot } from "../index";
import { startHandler } from "./startHandler";

export const returnHandler = async (msg: any) => {
  try {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    await startHandler(msg);
  } catch (error) {
    console.log("returnHandlerError: ", error);
  }
};
export const adminReturnHandler = async (msg: any) => {
  await startHandler(msg);
};
