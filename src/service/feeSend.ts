import feeSend from "../controller/feeSend";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { bot } from "../bot";
import config from "../config.json";
import { getKeyPairFromPrivatekey, decryptPrivateKey } from ".";
import { ObjectId } from "mongoose";
import { subString } from "../bot/library";
const connection = new Connection(clusterApiUrl("mainnet-beta"), {
  commitment: "confirmed",
  wsEndpoint: "wss://api.mainnet-beta.solana.com",
});
interface TSplTransferQueueInterface {
  _id: ObjectId;
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
  status: number;
}

export const FeeTransferQueueUpdator = async () => {
  const updator = async () => {
    try {
      const queues = (await feeSend.find({
        filter: {
          status: 0,
        },
      })) as TSplTransferQueueInterface[];
      console.log("SplTransferQueueUpdator running:", queues.length);
      if (queues.length > 0) {
        console.log(queues)
        for (let i = 0; i < queues.length; i++) {
          try {
            const privatekey = (await decryptPrivateKey(
              queues[i]?.privateKey
            )) as string;
            const sender = (await getKeyPairFromPrivatekey(privatekey)) as any;
            const to = new PublicKey(queues[i]?.withdrawAddress);
            const decimals = LAMPORTS_PER_SOL; // 1 SOL = 1e9 lamports
            const amount = await subString(queues[i]?.amount);
            const transferAmountInDecimals = Math.floor(amount * decimals);
            // Prepare transaction
            const { lastValidBlockHeight, blockhash } =
              await connection.getLatestBlockhash({ commitment: "finalized" });
            let newNonceTx = new Transaction();

            newNonceTx.feePayer = sender.publicKey;
            newNonceTx.recentBlockhash = blockhash;
            newNonceTx.lastValidBlockHeight = lastValidBlockHeight;
            newNonceTx.add(
              SystemProgram.transfer({
                fromPubkey: sender.publicKey,
                toPubkey: to,
                lamports: transferAmountInDecimals,
              })
            );
            // Simulate the transaction to estimate fees
            const tx = await sendAndConfirmTransaction(connection, newNonceTx, [
              sender,
            ]);
            if (tx) {
              await feeSend.updateOne({
                _id: queues[i]._id,
                status: 1,
                txId: tx,
              });
              const userText =
                `Fee Collected ${amount}sol  "Trade Well"- Trader Maxx\n` +
                `<a href="${config.solScanUrl}/${tx}"><i>View on Solscan</i></a>`;

              await bot.sendMessage(queues[i]?.userId, userText, {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "Return  👈", callback_data: "return" }],
                  ],
                },
              });
              const adminText =
                `Fee received ${queues[i]?.amount}sol into your wallet.\n\n` +
                `<a href="${config.solScanUrl}/${tx}"><i>View on Solscan</i></a>`;
              await bot.sendMessage(config.SUPER_ADMIN_ID, adminText, {
                parse_mode: "HTML",
              });
            }
          } catch (err: any) {
            console.error("Transaction failed:", err.message || err);
            return null;
          }
        }
      }
    } catch (err: any) {
      console.log("TransactionQueueUpdator :", err.message);
    }

    setTimeout(() => {
      updator();
    }, 3000);
  };
  updator();
};
