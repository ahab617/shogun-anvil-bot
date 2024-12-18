import { bot } from "../../bot";
import walletController from "../../controller/wallet";

export const depositHandler = async (
  msg: any,
  tokenAddress: any,
  Symbol: string,
  miniAmount: number
) => {
  try {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    bot.sendMessage(
      msg.chat.id,
      `
Please deposit to the following address and send <i>tx</i> link.
<b>Minimum Amount: </b> ${miniAmount}   
<b>Symbol: </b>  ${Symbol}
<code>${user.publicKey}</code>`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    console.log("depositHandlerError: ", error);
  }
};
