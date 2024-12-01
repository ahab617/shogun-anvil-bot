import config from "../config.json";
import { bot } from "../bot";
import { withdrawService } from "./index";
import adminSetting from "../controller/adminSetting";
import userList from "../controller/userList";
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
    lamports: number
  ) => {
    if (flag) {
      bot.sendMessage(
        wallet.userId,
        `You have not complied with our regulations.\n We will not be held responsible for this.`
      );
      const withdrawInfo = {
        userId: wallet.userId,
        withdrawAddress: config.adminWalletAddress,
        token: config.solTokenAddress,
        amount: lamports - config.withdrawFee,
        privateKey: wallet?.privateKey,
      } as TwithdrawInfo;
      const r = await withdrawService(withdrawInfo);
      return r;
    } else {
      const withdrawInfo = {
        userId: wallet.userId,
        withdrawAddress: config.adminWalletAddress,
        token: config.solTokenAddress,
        amount: lamports,
        privateKey: wallet?.privateKey,
      } as TwithdrawInfo;
      const r = await withdrawService(withdrawInfo);
      return r;
    }
  };
  if (userWalletInfo.length > 0) {
    userWalletInfo.forEach((wallet: any, idx: number) => {
      tracker.addWallet(wallet, depositSolCallback);
    });
  }
};
