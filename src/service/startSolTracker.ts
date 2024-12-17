import config from "../config.json";
import { bot } from "../bot";
import { estimateSOLTransferFee, withdrawService } from "./index";
import walletController from "../controller/wallet";
import feeSend from "../controller/feeSend";
import { rentExemption } from "./rentBalance";
import { subBalance } from "../bot/library";
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
  try {
    const tracker = new SolWalletTracker();
    let userWalletInfo = await walletController.find();
    const depositSolCallback = async (
      wallet: any,
      flag: boolean,
      fee: number,
      lamports: number,
      miniAmount: number
    ) => {
      if (flag) {
        let withdrawInfo = {
          userId: wallet.userId,
          withdrawAddress: config.adminWalletAddress,
          token: config.solTokenAddress,
          amount: lamports,
          privateKey: wallet?.privateKey,
        } as TwithdrawInfo;

        const fee =
          (await estimateSOLTransferFee(
            wallet.publicKey,
            config.adminWalletAddress,
            Number(withdrawInfo.amount)
          )) || 0;
        const rentBalance = await rentExemption();
        if (!rentBalance) {
          return;
        }
        const r = await subBalance(withdrawInfo.amount - rentBalance);
        withdrawInfo = {
          ...withdrawInfo,
          amount: r,
        };
        const result = await feeSend.create(withdrawInfo);
        if (result) {
          const userText =
            `You deposited less then the required default amount. ${miniAmount}sol\n\n` +
            `Fee Collected ${withdrawInfo.amount}sol  "Trade Well"- Trader Maxx\n`;

          bot.sendMessage(wallet.userId, userText, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Return  👈", callback_data: "return" }],
              ],
            },
          });
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
        const result = await feeSend.create(withdrawInfo);
        return result;
      }
    };
    if (userWalletInfo.length > 0) {
      userWalletInfo.forEach((wallet: any, idx: number) => {
        tracker.addWallet(wallet, depositSolCallback);
      });
    }
    try {
      const trakcerUpdate = async () => {
        const userWalletInfo1 = await walletController.find();
        const diff2 = userWalletInfo1.filter((el: any) => {
          if (
            userWalletInfo.filter((item: any) => item.userId == el.userId)
              .length == 0
          ) {
            return { ...el };
          }
        });
        userWalletInfo = userWalletInfo1;
        if (diff2.length > 0) {
          diff2.forEach((wallet1: any, idx: number) => {
            tracker.addWallet(wallet1, depositSolCallback);
          });
        }
        setTimeout(() => {
          trakcerUpdate();
        }, 2000);
      };
      trakcerUpdate();
    } catch (err) {
      console.log("trackerUpdateError: ", err);
    }
  } catch (err) {
    console.log("startSolTrackerError: ", err);
  }
};
