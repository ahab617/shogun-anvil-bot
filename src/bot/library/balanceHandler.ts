import axios from "axios";
import { bot } from "../index";
import { checkSolBalance } from "../../service/getBalance";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
import walletController from "../../controller/wallet";
import depositController from "../../controller/deposit";

export const balanceHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    let tokenAccount = "";
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    if (user) {
      try {
        const tokenInfo = await depositController.findOne({
          filter: { userId: msg.chat.id },
        });
        if (tokenInfo) {
          for (let i = 0; i < tokenInfo.tokenAddress.length; i++) {
            try {
              const balance = await checkSolBalance(user.publicKey);
              tokenAccount += `
<b>Name: </b>  Solana
<b>Symbol: </b>  SOL
<b>Token Address:</b>  <code>${tokenInfo.tokenAddress[i]}</code>
<b>Balance: </b>  ${balance} 
  `;
            } catch (error) {
              console.log("Error fetching token information:", error);
            }
          }

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
            const balance = (await checkSolBalance(user.publicKey)) || 0;
            tokenAccount += `
<b>Name: </b>  Solana
<b>Symbol: </b>  SOL
<b>Token Address:</b>  <code>${config.solTokenAddress}</code>
<b>Balance: </b>  ${balance} 
`;
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

const balanceModal = async (msg: any, tokenAccount: string) => {
  try {
    bot.sendMessage(
      msg.chat.id,
      `
<b>Here is your current wallet balance:</b> 
${tokenAccount}`,
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

const getTokenInfo = async (tokenAddress: string) => {
  try {
    const response = await axios(`${config.dexAPI}/${tokenAddress}`);
    if (response?.status == 200 && response?.data?.pairs) {
      const data = response.data.pairs[0];
      let token = {
        address: tokenAddress,
        name: data.baseToken.name,
        symbol: data.baseToken.symbol,
      };
      return token;
    } else {
      return null;
    }
  } catch (err) {
    console.log("getTokenInfo in balanceHandler: ", err);
    return null;
  }
};
