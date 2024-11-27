import {
  Connection,
  PublicKey,
  clusterApiUrl,
  AccountInfo,
} from "@solana/web3.js";
import adminSetting from "../controller/adminSetting";
import adminListController from "../controller/adminList";
import { depositTraker, isDepositStatus } from ".";
import config from "../config.json";
import userList from "../controller/userList";

interface WalletInfo {
  previousBalance: number;
  transferredReceived: boolean;
}

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}

export class SolWalletTracker {
  private connection: Connection;
  private walletAddresses: Map<
    string,
    { info: WalletInfo; subscriptionId: number }
  >;

  constructor() {
    this.connection = new Connection(clusterApiUrl("mainnet-beta"), {
      commitment: "confirmed",
      wsEndpoint: "wss://api.mainnet-beta.solana.com",
    });
    this.walletAddresses = new Map();
  }

  private logBalance(walletAddress: string, balance: number): void {
    console.log(`Initial balance for ${walletAddress}: ${balance / 1e9} SOL`);
  }

  async addWallet(
    wallet: any,
    callback?: (wallet1: any, isDepositStatus: boolean, amount: number) => void
  ): Promise<void> {
    if (this.walletAddresses.has(wallet.publicKey)) {
      console.log(`Wallet ${wallet.publicKey} is already being monitored.`);
      return;
    }

    const publicKey = new PublicKey(wallet.publicKey);
    try {
      const initialBalance = await this.connection.getBalance(publicKey);
      if (initialBalance === undefined) {
        console.error("Failed to obtain initial balance.");
        return;
      }

      this.logBalance(wallet.publicKey, initialBalance);

      const walletInfo: WalletInfo = {
        previousBalance: initialBalance,
        transferredReceived: false,
      };

      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        async (accountInfo: AccountInfo<Buffer>) => {
          const userData = await userList.findOne({ userId: wallet.userId });
          const currentBalance = accountInfo.lamports;
          const transferredAmount = currentBalance - walletInfo.previousBalance;

          // Update the previous balance
          if (isDepositStatus) {
            if (!walletInfo.transferredReceived && transferredAmount > 0) {
              callback?.(wallet, isDepositStatus, transferredAmount / 1e9);
              walletInfo.transferredReceived = true; // Mark as received
              this.removeWallet(
                wallet.userId,
                wallet.publicKey,
                subscriptionId
              ); // Optionally remove, based on logic
            }
            walletInfo.previousBalance = currentBalance;
            await depositTraker(false);
          } else {
            const adminList = await adminListController.find();
            if (
              wallet.userId == config.SUPER_ADMIN_ID ||
              adminList?.filter((item: any) => item.userId == wallet.userId)
                .length > 0 ||
              userData?.fee == 0
            ) {
              if (!walletInfo.transferredReceived && transferredAmount > 0) {
                callback?.(wallet, true, transferredAmount / 1e9);
                walletInfo.transferredReceived = true; // Mark as received
                this.removeWallet(
                  wallet.userId,
                  wallet.publicKey,
                  subscriptionId
                ); // Optionally remove, based on logic
              }
              walletInfo.previousBalance = currentBalance;
            } else {
              if (!walletInfo.transferredReceived && transferredAmount > 0) {
                callback?.(wallet, false, transferredAmount / 1e9);
                walletInfo.transferredReceived = true; // Mark as received
                this.removeWallet(
                  wallet.userId,
                  wallet.publicKey,
                  subscriptionId
                ); // Optionally remove, based on logic
              }
              const result = await adminSetting.find();
              const depositData = result?.result as Array<TdepositData>;
              if (
                Number(depositData[0].miniAmount) <=
                transferredAmount / 1e9
              ) {
                walletInfo.previousBalance =
                  currentBalance - transferredAmount * userData?.fee;
              }
            }
          }
        }
      );

      this.walletAddresses.set(wallet.publicKey, {
        info: walletInfo,
        subscriptionId,
      });
    } catch (error) {
      console.error(`Error adding wallet ${wallet.publicKey}:`, error);
    }
  }

  async removeWallet(
    userId: number,
    walletAddress: string,
    subscriptionId?: number
  ): Promise<void> {
    if (!this.walletAddresses.has(walletAddress)) {
      console.log(`Wallet ${walletAddress} is not being monitored.`);
      return;
    }

    if (subscriptionId) {
      await this.connection.removeAccountChangeListener(subscriptionId);
    }

    this.walletAddresses.delete(walletAddress);
    console.log(`Removed ${walletAddress} from monitoring list.`);
  }

  getTrackedWallets(): string[] {
    return Array.from(this.walletAddresses.keys());
  }
}
