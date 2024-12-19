import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import config from "../config.json";
export class SolWalletTracker {
  private connection: Connection;
  private walletAddresses: Map<string, { subscriptionId: number }>;

  constructor() {
    this.connection = new Connection(clusterApiUrl("mainnet-beta"), {
      commitment: "confirmed",
      wsEndpoint: "wss://api.mainnet-beta.solana.com",
    });
    this.walletAddresses = new Map();
  }

  async addWallet(
    wallet: any,
    callback?: (
      wallet1: any,
      transactionSignature: string,
      logs: string[]
    ) => void
  ): Promise<void> {
    if (this.walletAddresses.has(wallet.publicKey)) {
      return;
    }

    const publicKey = new PublicKey(wallet.publicKey);
    try {
      const subscriptionId = this.connection.onLogs(
        publicKey,
        async (logs) => {
          if (callback) {
            await callback(wallet, logs.signature, logs.logs);
          }
        },
        "confirmed"
      );

      this.walletAddresses.set(wallet.publicKey, { subscriptionId });
    } catch (error) {
      console.error(`Error adding wallet ${wallet.publicKey}:`, error);
    }
  }

  async removeWallet(walletAddress: string): Promise<void> {
    if (!this.walletAddresses.has(walletAddress)) {
      return;
    }

    const { subscriptionId } = this.walletAddresses.get(walletAddress)!;

    // Remove subscription
    this.connection.removeOnLogsListener(subscriptionId);
    this.walletAddresses.delete(walletAddress);
  }

  getTrackedWallets(): string[] {
    return Array.from(this.walletAddresses.keys());
  }
}
