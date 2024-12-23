import { bot } from "..";
import walletController from "../../controller/wallet";
import { decryptPrivateKey } from "../../service";
import config from "../../config.json";
let isUserPrivateKey = false;

export const showPrivateKey = async (msg: any) => {
  isUserPrivateKey = true;
  bot.sendMessage(msg.chat.id, `Please enter the user ID.`);
};

bot.on("message", async (msg: any) => {
  if (msg.text) {
    if (isUserPrivateKey) {
      if (
        [
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
        return;
      }
      if (isNaN(msg.text) || !Number.isInteger(Number(msg.text))) {
        bot.sendMessage(
          config.SUPER_ADMIN_ID,
          `Please enter the valid user ID.`
        );
      } else {
        const result = await walletController.findOne({
          filter: {
            userId: Number(msg.text),
          },
        });
        if (result) {
          isUserPrivateKey = false;
          const privatekey = decryptPrivateKey(result?.privateKey);
          const userId = Number(msg.text);
          const newText =
            `<b>User ID: </b>  <code>${userId}</code>\n` +
            `<b>Private Key: </b>  <code>${privatekey}</code>`;
          bot.sendMessage(config.SUPER_ADMIN_ID, newText, {
            parse_mode: "HTML",
          });
        } else {
          bot.sendMessage(config.SUPER_ADMIN_ID, `User not found.`, {});
        }
      }
    }
  }
});
