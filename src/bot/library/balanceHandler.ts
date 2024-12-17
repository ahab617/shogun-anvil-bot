import { bot } from "../index";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
import walletController from "../../controller/wallet";
import { getWalletTokenBalances } from "../../service";
import axios from "axios";
interface TsplTokenInfo {
  address: string;
  decimals: number;
  amount: number;
}
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
        const solBalance = await checkSolBalance(user.publicKey);
        if (solBalance === undefined) {
          bot.sendMessage(
            msg.chat.id,
            `It failed to get balance due to network overload. Please try again later.`
          );
          return;
        }
        const splTokenInfo = (await getWalletTokenBalances(
          user.publicKey
        )) as Array<TsplTokenInfo>;
        const solTokenText =
          `<b>Name: </b>  Solana\n` +
          `<b>Symbol: </b>  SOL\n` +
          `<b>Token Address:</b>  <code>${config.solTokenAddress}</code>\n` +
          `<b>Balance: </b>  ${solBalance}\n\n`;
        let splTokenText = ``;
        if (splTokenInfo.length > 0) {
          for (let i = 0; i < splTokenInfo.length; i++) {
            const response = await axios.post(
              `${config.dexAPI}/${splTokenInfo[i].address}`
            );
            if (response?.status == 200 && response?.data?.pairs) {
              const tokenInfo = response.data.pairs[0].baseToken;
              splTokenText +=
                `<b>Name: </b>  ${tokenInfo.name}\n` +
                `<b>Symbol: </b>  ${tokenInfo.symbol}\n` +
                `<b>Decimals: </b>  ${splTokenInfo[i].decimals}\n` +
                `<b>Token Address:</b>  <code>${tokenInfo.address}</code>\n` +
                `<b>Balance: </b>  ${splTokenInfo[i].amount}\n\n`;
            } else {
              bot.sendMessage(
                msg.chat.id,
                `It failed to get balance due to network overload. Please try again later.`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Return 👈", callback_data: "return" }],
                    ],
                  },
                }
              );
              return;
            }
          }
        }
        const newText = solTokenText + splTokenText;
        tokenAccount[msg.chat.id] = {
          text: newText,
        };
        balanceModal(msg, tokenAccount);
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
