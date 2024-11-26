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
    if (!flag) {
      const result = await adminSetting.find();
      const depositData = result?.result as Array<TdepositData>;
      const userData = await userList.findOne({ userId: wallet.userId });
      if (Number(depositData[0].miniAmount) > lamports) {
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
        await withdrawService(withdrawInfo);
      } else {
        const withdrawInfo = {
          userId: wallet.userId,
          withdrawAddress: config.adminWalletAddress,
          token: config.solTokenAddress,
          amount: (lamports * userData?.fee) / 100,
          privateKey: wallet?.privateKey,
        } as TwithdrawInfo;
        await withdrawService(withdrawInfo);
      }
    } else {
      return;
    }
  };
  if (userWalletInfo.length > 0) {
    userWalletInfo.forEach((wallet: any, idx: number) => {
      tracker.addWallet(wallet, depositSolCallback);
    });
  }
};
