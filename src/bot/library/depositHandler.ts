import { bot } from "../index";
import { removeAnswerCallback } from "./index";
import walletController from "../../controller/wallet";
import tokenController from "../../controller/tokenSetting";
import userList from "../../controller/userList";
import config from "../../config.json";
import { Connection, PublicKey } from "@solana/web3.js";
import depositController from "../../controller/deposit";

const connection = new Connection(config.rpcUrl);

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}

let userWalletAddress = {} as any;
let depositData: Array<TdepositData> | [];
let userData: any = null;
let tokenDepositInfo = {} as any;
let depositInput = {} as any;

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
        userWalletAddress[msg.chat.id] = {
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
          userData = await userList.findOne({ userId: msg.chat.id });

          if (!userData?.permission) {
            bot.sendMessage(
              msg.chat.id,
              `You have not been Whitelisted please contact Admin.`
            );
            return;
          }
          depositInput[msg.chat.id] = {
            flag: true,
          };
          const newText =
            `Please deposit to the following address and input the TxId.\n\n` +
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
const isValidtxSignature = async (msg: any, publicKey: string) => {
  bot.sendMessage(msg.chat.id, `Please enter the valid TxId.`);
};
bot.on("message", async (msg: any) => {
  if (msg.text) {
    if (depositInput[msg.chat.id]?.flag) {
      if (
        [
          "/cancel",
          "/support",
          "/start",
          "/wallet",
          "/token",
          "/deposit",
          "/withdraw",
          "/balance",
          "/activity",
          "/showprivatekey",
          "/totaluser",
          "/addpermission",
          "/manage",
        ].includes(msg.text)
      ) {
        depositInput[msg.chat.id] = {
          flag: false,
        };
        return;
      }
      try {
        let txSignature = msg.text.includes(config.solScanUrl)
          ? msg.text.split("/").pop() || ""
          : (msg.text as string);
        if (txSignature.toString().length !== 88) {
          isValidtxSignature(msg, userWalletAddress[msg.chat.id].publicKey);
          return;
        }
        // Fetch the parsed transaction using the tx signature
        const tx = (await connection.getParsedTransaction(txSignature, {
          commitment: "finalized",
        })) as any;
        if (!tx || !tx.meta || !tx.transaction) {
          await isValidtxSignature(
            msg,
            userWalletAddress[msg.chat.id].publicKey
          );
        } else {
          // Loop through the instructions to find the receiving address
          for (const instruction of tx.transaction.message.instructions) {
            if (
              instruction.programId.toString() ===
              "11111111111111111111111111111111"
            ) {
              const parsed = instruction?.parsed as any;

              if (
                (parsed.type === "transfer" && parsed.info) ||
                (parsed.type === "transferChecked" && parsed.info)
              ) {
                const receiverAddress = parsed.info.destination;

                if (
                  userWalletAddress[msg.chat.id]?.publicKey === receiverAddress
                ) {
                  const InputAmount = parsed.info.lamports / 1e9;
                  const depositInfo = {
                    userId: msg.chat.id,
                    txId: txSignature,
                    amount: InputAmount,
                    tokenAddress: config.solTokenAddress,
                  };
                  const result = await depositController.create(depositInfo);
                  if (result?.status == 200) {
                    await bot.sendMessage(
                      msg.chat.id,
                      `<a href="${config.solScanUrl}/${txSignature}"><i>View on Solscan</i></a>`,
                      {
                        parse_mode: "HTML",
                      }
                    );
                    depositInput[msg.chat.id] = {
                      flag: false,
                    };
                  } else if (result?.status == 201) {
                    await bot.sendMessage(msg.chat.id, `${result?.msg}`, {
                      parse_mode: "HTML",
                    });
                  }
                } else {
                  await isValidtxSignature(msg, userWalletAddress.publicKey);
                }
              }
            } else if (
              instruction.programId.toString() === config.splTokenAddress
            ) {
              const parsed = instruction.parsed;
              if (
                (parsed.type === "transfer" && parsed.info) ||
                (parsed.type === "transferChecked" && parsed.info)
              ) {
                const receiverTokenAccount = parsed.info.destination;
                const tokenAmount = parsed.info.amount; // Amount in smallest unit (e.g., lamports for SOL or smallest fraction of token)
                // Convert to human-readable amount (if applicable, based on token decimals)
                const tokenDecimals = parsed.info.decimals || 0; // Ensure decimals are provided or fallback to 0
                const amount = tokenAmount / Math.pow(10, tokenDecimals);
                const accountInfo = (await connection.getParsedAccountInfo(
                  new PublicKey(receiverTokenAccount)
                )) as any;
                if (accountInfo && accountInfo.value) {
                  const receiverAddress =
                    accountInfo.value.data.parsed.info.owner;
                  if (
                    !(
                      userWalletAddress[msg.chat.id].publicKey.publicKey ===
                      receiverAddress
                    )
                  ) {
                    await isValidtxSignature(
                      msg,
                      userWalletAddress[msg.chat.id].publicKey
                    );
                  } else {
                    const depositInfo = {
                      userId: msg.chat.id,
                      txId: txSignature,
                      amount: amount,
                      tokenAddress: accountInfo.value.data.parsed.info.mint,
                    };
                    const result = await depositController.create(depositInfo);
                    if (result?.status == 200) {
                      await bot.sendMessage(
                        msg.chat.id,
                        `<a href="${config.solScanUrl}/${txSignature}"><i>View on Solscan</i></a>`,
                        {
                          parse_mode: "HTML",
                        }
                      );
                      depositInput[msg.chat.id] = {
                        flag: false,
                      };
                    } else if (result?.status == 201) {
                      await bot.sendMessage(msg.chat.id, `${result?.msg}`, {
                        parse_mode: "HTML",
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("Error to get the ParsedTransaction: ", error);
      }
    }
  }
});
