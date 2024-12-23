import { bot } from "..";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
import userList from "../../controller/userList";
import { encryptPrivateKey } from "../../service";
import walletController from "../../controller/wallet";

const solanaWeb3 = require("@solana/web3.js");

export const walletHandler = async (msg: any) => {
  try {
    const userpermission = await userList.findOne({ userId: msg.chat.id });
    if (!userpermission?.permission) {
      bot.sendMessage(
        msg.chat.id,
        `No permission. Please check the below link.`,
        {
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Contact Us",
                  url: `${config.supportUrl}`,
                },
              ],
            ],
          },
        }
      );
      return;
    }
    removeAnswerCallback(msg.chat);
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    if (!user) {
      const keypair = solanaWeb3.Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = await encryptPrivateKey(
        Buffer.from(keypair.secretKey).toString("base64")
      );

      const r = await walletController.create(
        msg.chat.id,
        publicKey,
        privateKey
      );
      if (r) {
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
            "/showprivatekey",
            "/totaluser",
            "/addpermission",
            "/manage",
          ].includes(msg.text)
        ) {
          bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: msg.chat.id, message_id: msg.message_id }
          );
        }
        bot.sendMessage(
          msg.chat.id,
          `
<b>Your Anvil Wallet is connected</b>
${publicKey}

<b>You can deposit to this wallet by using this.</b>
/deposit
          `,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Return 👈", callback_data: "return" },
                  {
                    text: "Disconnect ❌",
                    callback_data: "delete_wallet",
                  },
                ],
              ],
            },
          }
        );
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
          "/showprivatekey",
          "/totaluser",
          "/addpermission",
          "/manage",
        ].includes(msg.text)
      ) {
        bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );
      }
      bot.sendMessage(
        msg.chat.id,
        `
<b>Your Anvil Wallet is connected.</b>
<code>${user.publicKey}</code>

You can deposit to this wallet by using this.
/deposit
        `,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "return 👈", callback_data: "return" },
                {
                  text: "Disconnect ❌",
                  callback_data: "delete_wallet",
                },
              ],
            ],
          },
        }
      );
    }
  } catch (err) {
    console.log("Error wallet handler: ", err);
  }
};
