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
import { getKeyPairFromPrivatekey, decryptPrivateKey, sendSol } from ".";
import { ObjectId } from "mongoose";
import { subBalance } from "../bot/library";
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
  flag: boolean;
  miniAmount: number;
}

interface TtxId {
  result: string | null;
  msg: string;
}

export const FeeTransferQueueUpdator = async () => {
  const updator = async () => {
    try {
      const queues = (await feeSend.find({
        filter: {
          status: 0,
        },
      })) as TSplTransferQueueInterface[];

      // console.log("SplTransferQueueUpdator running:", queues.length);

      if (queues.length > 0) {
        queues.map(async (queue: any, idx: number) => {
          try {
            const privatekey = (await decryptPrivateKey(
              queue?.privateKey
            )) as string;
            const sender = (await getKeyPairFromPrivatekey(privatekey)) as any;
            const to = new PublicKey(queue.withdrawAddress);
            const decimals = LAMPORTS_PER_SOL; // 1 SOL = 1e9 lamports
            const transferAmountInDecimals = Math.floor(
              queue.amount * decimals
            );
            // Prepare transaction
            const { lastValidBlockHeight, blockhash } =
              await connection.getLatestBlockhash({
                commitment: "finalized",
              });
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
            const tx = await sendAndConfirmTransaction(connection, newNonceTx, [
              sender,
            ]);
            if (tx) {
              await feeSend.updateOne({
                _id: queue._id,
                status: 1,
                txId: tx,
              });

              let userText = ``;
              const value = await subBalance(queue.amount);
              if (queue?.flag) {
                userText =
                  `You deposited less than the required default amount. ${queue?.miniAmount}sol\n\n` +
                  `Fee Collected ${value}sol  "Trade Well"- Trader Maxx\n` +
                  `<a href="${config.solScanUrl}/${tx}"><i>View on Solscan</i></a>`;
              } else {
                userText =
                  `Fee Collected ${value}sol  "Trade Well"- Trader Maxx\n` +
                  `<a href="${config.solScanUrl}/${tx}"><i>View on Solscan</i></a>`;
              }

              await bot.sendMessage(queue?.userId, userText, {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "Return  👈", callback_data: "return" }],
                  ],
                },
              });

              const adminText =
                `Fee received ${value}sol into your wallet.\n\n` +
                `<a href="${config.solScanUrl}/${tx}"><i>View on Solscan</i></a>`;
              await bot.sendMessage(config.SUPER_ADMIN_ID, adminText, {
                parse_mode: "HTML",
              });
            }
          } catch (err: any) {
            console.error(
              "Transaction failed for queue " + queue._id + ":",
              err.message || err
            );
          }
        });
      }
    } catch (err: any) {
      console.log("Error in SplTransferQueueUpdator:", err.message);
    }

    // Ensure setTimeout() continues even if an error occurs
    setTimeout(() => {
      updator();
    }, 5000); // 5 seconds
  };

  updator();
};
