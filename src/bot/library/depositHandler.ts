import { bot } from "../index";
import { removeAnswerCallback } from "./index";
import walletController from "../../controller/wallet";
import adminSetting from "../../controller/adminSetting";
import tokenController from "../../controller/tokenSetting";
import userList from "../../controller/userList";

interface TuserWalletAddress {
  publicKey: string;
  privateKey: string;
}

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}

let userWalletAddress: TuserWalletAddress | null;
let depositData: Array<TdepositData> | [];
let userData: any = null;
let tokenDepositInfo = {} as any;

export const depositHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    if (user) {
      try {
        userWalletAddress = {
          publicKey: user.publicKey,
          privateKey: user.privateKey,
        };

        const user1 = await tokenController.findOne({
          filter: {
            userId: msg.chat.id,
          },
        });

        if (!user1) {
          bot.sendMessage(
            msg.chat.id,
            `⚠️ <b>Please set up the token.</b> ⚠️`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Return 👈", callback_data: "return" }],
                ],
              },
            }
          );
        } else {
          const result = await adminSetting.find();
          userData = await userList.findOne({ userId: msg.chat.id });
          depositData = result?.result as Array<TdepositData>;

          if (depositData?.length <= 0 || !userData?.permission) {
            bot.sendMessage(
              msg.chat.id,
              `You have not been Whitelisted please contact Admin.`
            );
            return;
          }
          const newText =
            `Please deposit to the following address.\n\n` +
            `<b>MiniAmount: </b> ${depositData[0].miniAmount}  SOL\n` +
            `<b>Fee: </b> ${userData?.fee}  %\n` +
            `The management is not responsible for any consequences resulting from non-compliance with these regulations.\n\n` +
            `<code>${user.publicKey}</code>`;
          bot.sendMessage(msg.chat.id, newText, { parse_mode: "HTML" });
        }
      } catch (error) {
        console.log("Overall transaction flow error:", error);
      }
    } else {
      bot.sendMessage(msg.chat.id, `Please connect the wallet address.`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Cancel  👈", callback_data: "return" }]],
        },
      });
    }
  } catch (error) {
    console.log("Error deposit handler:", error);
  }
};
