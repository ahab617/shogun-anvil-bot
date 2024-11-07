import { bot } from "../index";
import { startHandler } from "./startHandler";
import walletController from "../../controller/wallet";
import tokenSettingController from "../../controller/tokenSetting";

export const deleteWallethandler = async (msg: any) => {
  try {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );

    bot.sendMessage(
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
    console.error("Error handling reset wallet message:", error);
  }
};

export const confirmHandler = async (msg: any) => {
  try {
    await walletController.deleteOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    bot.sendMessage(msg.chat.id, `✅ Reset is successfully completed.`);

    startHandler(msg);
  } catch (error) {
    console.error("Error during wallet reset:", error);
  }
};

export const deleteTokenHandler = async (msg: any) => {
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: msg.chat.id, message_id: msg.message_id }
  );
  bot.sendMessage(msg.chat.id, `Would you like to delete your token?`, {
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
};

export const confirmTokenHandler = async (msg: any) => {
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: msg.chat.id, message_id: msg.message_id }
  );

  try {
    const r = await tokenSettingController.deleteOne({
      filter: { userId: msg.chat.id },
    });

    if (r?.status === 200) {
      bot.sendMessage(msg.chat.id, `✅ Reset is successfully completed.`);
      startHandler(msg);
    } else if (r?.status === 202) {
      bot.sendMessage(msg.chat.id, `⚠️ Reset failed. Please try again.`);
    } else if (r?.status === 500) {
      bot.sendMessage(
        msg.chat.id,
        `⚠️ An error has occurred on the server. Please try again later.`
      );
    } else {
      bot.sendMessage(
        msg.chat.id,
        `Unexpected response received. Please contact support.`
      );
    }
  } catch (error) {
    console.error("Error during reset:", error);
  }
};
