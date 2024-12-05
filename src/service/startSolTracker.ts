import config from "../config.json";
import { bot } from "../bot";
import { withdrawService } from "./index";
import adminSetting from "../controller/adminSetting";
import userList from "../controller/userList";
import withdrawController from "../controller/withdraw";
import walletController from "../controller/wallet";
const { SolWalletTracker } = require("../service/solWalletTracket");

interface TwithdrawInfo {
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
}

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}

export const startSolTracker = async () => {
  const tracker = new SolWalletTracker();
  const userWalletInfo = await walletController.find();
  const depositSolCallback = async (
    wallet: any,
    flag: boolean,
    fee: number,
    lamports: number,
    miniAmount: number
  ) => {
    if (flag) {
      const withdrawInfo = {
        userId: wallet.userId,
        withdrawAddress: config.adminWalletAddress,
        token: config.solTokenAddress,
        amount: lamports - config.withdrawFee,
        privateKey: wallet?.privateKey,
      } as TwithdrawInfo;

      const result = await withdrawService(withdrawInfo);
      if (result) {
        const userText =
          `You deposited less then the required default amount. ${miniAmount}sol\n\n` +
          `Fee Collected ${withdrawInfo.amount}sol  "Trade Well"- Trader Maxx\n` +
          `<a href="${config.solScanUrl}/${result}"><i>View on Solscan</i></a>`;
        bot.sendMessage(wallet.userId, userText, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Return  👈", callback_data: "return" }],
            ],
          },
        });
        const adminText =
          `Fee received ${withdrawInfo.amount}sol into your wallet.\n\n` +
          `<a href="${config.solScanUrl}/${result}"><i>View on Solscan</i></a>`;
        bot.sendMessage(config.SUPER_ADMIN_ID, adminText, {
          parse_mode: "HTML",
        });
        await withdrawController.create(withdrawInfo);
      }
      return result;
    } else {
      const withdrawInfo = {
        userId: wallet.userId,
        withdrawAddress: config.adminWalletAddress,
        token: config.solTokenAddress,
        amount: (lamports * fee) / 100,
        privateKey: wallet?.privateKey,
      } as TwithdrawInfo;
      const result = await withdrawService(withdrawInfo);
      if (result) {
        const adminText =
          `Fee received ${withdrawInfo.amount}sol into your wallet.\n\n` +
          `<a href="${config.solScanUrl}/${result}"><i>View on Solscan</i></a>`;
        bot.sendMessage(config.SUPER_ADMIN_ID, adminText, {
          parse_mode: "HTML",
        });
        await withdrawController.create(withdrawInfo);
      }
      return result;
    }
  };
  if (userWalletInfo.length > 0) {
    userWalletInfo.forEach((wallet: any, idx: number) => {
      tracker.addWallet(wallet, depositSolCallback);
    });
  }
};
