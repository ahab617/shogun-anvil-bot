import config from "../config.json";
import { delay, estimateSOLTransferFee } from "./index";
import walletController from "../controller/wallet";
import feeSend from "../controller/feeSend";
import { subBalance } from "../bot/library";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import adminSetting from "../controller/adminSetting";
import userList from "../controller/userList";
const { SolWalletTracker } = require("../service/solWalletTracket");

const connection = new Connection(config.rpcUrl);

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
      transactionSignature: string,
      logs: string[]
    ) => {
      delay(5000);
      const parsedTx = await connection.getParsedTransaction(
        transactionSignature,
        {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        }
      );
      console.log(parsedTx);
      if (!parsedTx || !parsedTx?.meta || !parsedTx?.meta.logMessages) {
        console.log("Invalid or unsupported transaction format");
        return;
      }
      await feeProcessFunc(wallet, parsedTx);
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

const feeProcessFunc = async (wallet: any, transactionDetails: any) => {
  try {
    const tx = transactionDetails;
    const result = await adminSetting.find();
    const userData = await userList.findOne({ userId: wallet.userId });
    const depositData = result?.result as Array<TdepositData>;
    for (const instruction of tx.transaction.message.instructions) {
      if (
        instruction.programId.toString() === "11111111111111111111111111111111"
      ) {
        const parsed = instruction?.parsed as any;
        if (
          (parsed?.type === "transfer" && parsed?.info) ||
          (parsed?.type === "transferChecked" && parsed?.info)
        ) {
          const InputAmount = await subBalance(parsed?.info.lamports / 1e9);
          const receiverAddress = parsed?.info.destination;
          if (receiverAddress === wallet.publicKey) {
            if (userData?.fee > 0 && depositData[0].miniAmount <= InputAmount) {
              const withdrawInfo = {
                userId: wallet.userId,
                withdrawAddress: config.adminWalletAddress,
                token: config.solTokenAddress,
                amount: (InputAmount * userData?.fee) / 100,
                privateKey: wallet?.privateKey,
                miniAmount: depositData[0].miniAmount,
                flag: false,
              } as TwithdrawInfo;
              await feeSend.create(withdrawInfo);
              // return result;
            } else if (depositData[0].miniAmount > InputAmount) {
              const fee =
                (await estimateSOLTransferFee(
                  wallet.publicKey,
                  config.adminWalletAddress,
                  Number(InputAmount)
                )) || 0;

              const realAmount = await subBalance(
                InputAmount - (fee / 1e9 || config.withdrawFee)
              );

              let withdrawInfo = {
                userId: wallet.userId,
                withdrawAddress: config.adminWalletAddress,
                token: config.solTokenAddress,
                amount: realAmount,
                privateKey: wallet?.privateKey,
                miniAmount: depositData[0].miniAmount,
                flag: true,
              } as TwithdrawInfo;

              await feeSend.create(withdrawInfo);
            }
          } else {
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.log("feeProcessFunc: ", error);
  }
};
