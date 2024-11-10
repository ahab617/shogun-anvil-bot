import { bot } from "../index";
import { startHandler } from "./startHandler";
import walletController from "../../controller/wallet";
import tokenSettingController from "../../controller/tokenSetting";

export const deleteWallethandler = async (msg: any) => {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );

    await bot.sendMessage(
      msg.chat.id,
      `
  Would you like to reset your wallet?
  Please check your wallet balance again.
  `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Cancel 👈", callback_data: "return" },
              { text: "OK ✔️", callback_data: "agree_delete_wallet" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("Error handling reset wallet message:", error);
  }
};

export const confirmHandler = async (msg: any) => {
  try {
    await walletController.deleteOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    await bot.sendMessage(msg.chat.id, `✅ Reset is successfully completed.`);

    await startHandler(msg);
  } catch (error) {
    console.log("Error during wallet reset:", error);
  }
};

export const deleteTokenHandler = async (msg: any) => {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    await bot.sendMessage(msg.chat.id, `Would you like to delete your token?`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Cancel  👈", callback_data: "return" },
            { text: "OK  ✔️", callback_data: "agree_delete_token" },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("deleteTokenHandlerError:", error);
  }
};

export const confirmTokenHandler = async (msg: any) => {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    const r = await tokenSettingController.deleteOne({
      filter: { userId: msg.chat.id },
    });

    if (r?.status === 200) {
      bot.sendMessage(msg.chat.id, `✅ Reset is successfully completed.`);
      startHandler(msg);
    } else if (r?.status === 202) {
      bot.sendMessage(msg.chat.id, `⚠️ Reset failed. Please try again.`);
    }
  } catch (error) {
    console.log("confirmTokenHandlerError:", error);
  }
};
