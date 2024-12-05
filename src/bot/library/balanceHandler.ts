import axios from "axios";
import { bot } from "../index";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
import walletController from "../../controller/wallet";
import tokenSettingController from "../../controller/tokenSetting";
let tokenAccount = {} as any;
export const balanceHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);

    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    if (user) {
      try {
        const tokenInfo = await tokenSettingController.findOne({
          filter: { userId: msg.chat.id },
        });
        const solBalance = (await checkSolBalance(user.publicKey)) || 0;
        if (tokenInfo) {
          const splTokenBalance =
            (await checkSplTokenBalance(tokenInfo.publicKey, user.publicKey)) ||
            0;
          let newText =
            `
<b>Name: </b>  Solana
<b>Symbol: </b>  SOL
<b>Token Address:</b>  <code>${config.solTokenAddress}</code>
<b>Balance: </b>  ${solBalance}\n\n` +
            `<b>Name: </b>  ${tokenInfo.name}
<b>Symbol: </b>  ${tokenInfo.symbol}
<b>Token Address:</b>  <code>${tokenInfo.publicKey}</code>
<b>Balance: </b>  ${splTokenBalance}
  `;
          tokenAccount[msg.chat.id] = {
            text: newText,
          };
          balanceModal(msg, tokenAccount);
        } else {
          if (
            ![
              "/cancel",
              "/support",
              "/start",
              "/wallet",
              "/token",
              "/deposit",
              "/withdraw",
              "/balance",
              "/activity",
            ].includes(msg.text)
          ) {
            bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: msg.chat.id, message_id: msg.message_id }
            );
          }

          try {
            let newText = `
<b>Name: </b>  Solana
<b>Symbol: </b>  SOL
<b>Token Address:</b>  <code>${config.solTokenAddress}</code>
<b>Balance: </b>  ${solBalance} 
`;
            tokenAccount[msg.chat.id] = {
              text: newText,
            };
            balanceModal(msg, tokenAccount);
          } catch (error) {
            console.log("Error fetching token information:", error);
          }
        }
      } catch (error) {
        console.log("Error accessing deposit information:", error);
      }
    } else {
      if (
        ![
          "/cancel",
          "/support",
          "/start",
          "/wallet",
          "/token",
          "/deposit",
          "/withdraw",
          "/balance",
          "/activity",
        ].includes(msg.text)
      ) {
        bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );
      }

      bot.sendMessage(msg.chat.id, `Connect your wallet to continue.`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return 👈", callback_data: "return" }]],
        },
      });
    }
  } catch (error) {
    console.log("Unexpected error:", error);
  }
};

const balanceModal = async (msg: any, tokenAccount: any) => {
  try {
    bot.sendMessage(
      msg.chat.id,
      `
<b>Here is your current wallet balance:</b> 
${tokenAccount[msg.chat.id]?.text}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return 👈", callback_data: "return" }]],
        },
      }
    );
  } catch (error) {
    console.log("Error sending wallet balance message:", error);
  }
};
