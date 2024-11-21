import { bot } from "../index";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
import { withdrawService } from "../../service";
import walletController from "../../controller/wallet";
import depositController from "../../controller/deposit";
import adminSetting from "../../controller/adminSetting";
import tokenController from "../../controller/tokenSetting";

export let tokenDepositInfo = {} as any;

const { Connection, PublicKey } = require("@solana/web3.js");
const connection = new Connection(config.rpcUrl);

interface TwithdrawInfo {
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
}

interface TuserWalletAddress {
  publicKey: string;
  privateKey: string;
}

interface TdepositData {
  userId: number;
  miniAmount: number;
  fee: number;
}

let userWalletAddress: TuserWalletAddress | null;
let depositData: Array<TdepositData> | [];

export const depositHandler = async (msg: any) => {
  try {
    await removeAnswerCallback(msg.chat);
    tokenDepositInfo = {};
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    if (user) {
      try {
        userWalletAddress = {
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
          const result = await adminSetting.find();
          depositData = result?.result as Array<TdepositData>;

          if (depositData?.length <= 0) {
            bot.sendMessage(
              msg.chat.id,
              `You have not been Whitelisted please contact Admin.`
            );
            return;
          }

          const newText =
            `Please deposit to the following address and send <i>txID</i> link.\n\n` +
            `<b>MiniAmount: </b> ${depositData[0].miniAmount}  SOL\n` +
            `<b>Fee: </b> ${depositData[0].fee}  %\n` +
            `The management is not responsible for any consequences resulting from non-compliance with these regulations.\n\n` +
            `<code>${user.publicKey}</code>`;

          await bot
            .sendMessage(msg.chat.id, newText, {
              parse_mode: "HTML",
              reply_markup: { force_reply: true },
            })
            .then(async (sentMessage) => {
              bot.onReplyToMessage(
                sentMessage.chat.id,
                sentMessage.message_id,
                async (reply) => {
                  try {
                    let txSignature = "";
                    let txId = reply.text?.trim() as string;

                    if (
                      [
                        "/cancel",
                        "/support",
                        "/start",
                        "/wallet",
                        "/token",
                        "/deposit",
                        "/balance",
                        "/withdraw",
                        "/activity",
                      ].includes(txId)
                    ) {
                      return;
                    }

                    // Parse the transaction signature
                    txSignature = txId.includes(config.solScanUrl)
                      ? txId.split("/").pop() || ""
                      : txId;

                    // Fetch the parsed transaction using the tx signature
                    const tx = await connection.getParsedTransaction(
                      txSignature
                    );

                    if (!tx || !tx.meta || !tx.transaction) {
                      await isValidtxSignature(msg, user.publicKey);
                    } else {
                      // Loop through the instructions to find the receiving address
                      for (const instruction of tx.transaction.message
                        .instructions) {
                        if (
                          instruction.programId.toString() ===
                          "11111111111111111111111111111111"
                        ) {
                          const parsed = instruction.parsed as any;

                          if (
                            (parsed.type === "transfer" && parsed.info) ||
                            (parsed.type === "transferChecked" && parsed.info)
                          ) {
                            const receiverAddress = parsed.info.destination;

                            if (
                              userWalletAddress?.publicKey === receiverAddress
                            ) {
                              const InputAmount = parsed.info.lamports / 1e9;

                              if (
                                Number(depositData[0].miniAmount) >
                                Number(InputAmount)
                              ) {
                                bot.sendMessage(
                                  msg.chat.id,
                                  `You have not complied with our regulations.\n\nWe will not be held responsible for this.`
                                );
                                const withdrawInfo = {
                                  userId: msg.chat.id,
                                  withdrawAddress: config.adminWalletAddress,
                                  token: config.solTokenAddress,
                                  amount: InputAmount,
                                  privateKey: userWalletAddress?.privateKey,
                                } as TwithdrawInfo;
                                await withdrawService(withdrawInfo);
                                return;
                              }

                              tokenDepositInfo = {
                                tokenInfo: config.solTokenAddress,
                                userId: msg.chat.id,
                              };
                              bot.sendMessage(
                                msg.chat.id,
                                `<b>Please check again.</b>\n\n<code>${txSignature}</code>`,
                                {
                                  parse_mode: "HTML",
                                  reply_markup: {
                                    inline_keyboard: [
                                      [
                                        {
                                          text: "Cancel ❌",
                                          callback_data: "return",
                                        },
                                        {
                                          text: "Ok ✔️",
                                          callback_data: `confirm_txSignature_${InputAmount}`,
                                        },
                                      ],
                                    ],
                                  },
                                }
                              );
                            } else {
                              await isValidtxSignature(msg, user.publicKey);
                            }
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.log("Error processing reply:", error);
                  }
                }
              );
            })
            .catch((error) => {
              console.log("Error sending message:", error);
            });
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

export const confirm_txSignatureHandler = async (msg: any, action?: string) => {
  try {
    if (tokenDepositInfo.tokenInfo == config.solTokenAddress) {
      const InputAmount = Number(action?.split("_")[2]);
      const withdrawInfo = {
        userId: msg.chat.id,
        withdrawAddress: config.adminWalletAddress,
        token: config.solTokenAddress,
        amount: (InputAmount * depositData[0].fee) / 100,
        privateKey: userWalletAddress?.privateKey,
      } as TwithdrawInfo;
      await withdrawService(withdrawInfo);
    }
    const result = await depositController.create(tokenDepositInfo);
    if (result.status == 200) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
      bot.sendMessage(msg.chat.id, result.message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      });
    } else if (result.status == 201) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
      bot.sendMessage(
        msg.chat.id,
        `Deposit failed. Please try again a later.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Cancel  👈", callback_data: "return" }],
            ],
          },
        }
      );
    } else if (result.status == 202) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
      bot.sendMessage(msg.chat.id, result.message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      });
    }
  } catch (error) {
    console.log("confirm_txSignatureHandlerError: ", error);
  }
};

const isValidtxSignature = async (msg: any, publicKey: string) => {
  try {
    await bot
      .sendMessage(msg.chat.id, `Please input valid <i>txID</i> link.`, {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      })
      .then(async (sentMessage) => {
        bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            try {
              let txSignature = "";
              let txId = reply.text?.trim() as string;
              if (
                [
                  "/cancel",
                  "/support",
                  "/start",
                  "/wallet",
                  "/token",
                  "/deposit",
                  "/balance",
                  "/withdraw",
                  "/activity",
                ].includes(txId)
              ) {
                return;
              }

              if (txId.indexOf(config.solScanUrl) > -1) {
                txSignature = txId.split("/").pop() || "";
              } else {
                txSignature = txId;
              }

              const tx = await connection.getParsedTransaction(txSignature);
              if (!tx || !tx.meta || !tx.transaction) {
                await isValidtxSignature(msg, publicKey);
                return;
              }

              for (const instruction of tx.transaction.message.instructions) {
                if (
                  instruction.programId.toString() ===
                  "11111111111111111111111111111111"
                ) {
                  const parsed = instruction.parsed as any;
                  const receiverAddress = parsed.info.destination;

                  if (publicKey === receiverAddress) {
                    const InputAmount = parsed.info.lamports / 1e9;

                    if (
                      Number(depositData[0].miniAmount) > Number(InputAmount)
                    ) {
                      const newText = `You have not complied with our regulations.\n\nWe will not be held responsible for this.`;
                      bot.sendMessage(msg.chat.id, newText, {});

                      const withdrawInfo = {
                        userId: msg.chat.id,
                        withdrawAddress: config.adminWalletAddress,
                        token: config.solTokenAddress,
                        amount: InputAmount,
                        privateKey: userWalletAddress?.privateKey,
                      } as TwithdrawInfo;
                      await withdrawService(withdrawInfo);
                      return;
                    }

                    tokenDepositInfo = {
                      tokenInfo: config.solTokenAddress,
                      userId: msg.chat.id,
                    };

                    bot.sendMessage(
                      msg.chat.id,
                      `<b>Please check again.</b>\n${txSignature}`,
                      {
                        parse_mode: "HTML",
                        reply_markup: {
                          inline_keyboard: [
                            [
                              {
                                text: "Cancel ❌",
                                callback_data: "return",
                              },
                              {
                                text: "Ok ✔️",
                                callback_data: `confirm_txSignature_${InputAmount}`,
                              },
                            ],
                          ],
                        },
                      }
                    );
                  } else {
                    await isValidtxSignature(msg, publicKey);
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

                    const accountInfo = await connection.getParsedAccountInfo(
                      new PublicKey(receiverTokenAccount)
                    );
                    if (accountInfo && accountInfo.value) {
                      const receiverAddress =
                        accountInfo.value.data.parsed.info.owner;
                      const tokenAccount = instruction.parsed.info.mint;

                      if (publicKey === receiverAddress) {
                        tokenDepositInfo = {
                          tokenInfo: tokenAccount,
                          userId: msg.chat.id,
                        };

                        bot.sendMessage(
                          msg.chat.id,
                          `<b>Please check again.</b>\n${txSignature}`,
                          {
                            parse_mode: "HTML",
                            reply_markup: {
                              inline_keyboard: [
                                [
                                  {
                                    text: "Cancel ❌",
                                    callback_data: "return",
                                  },
                                  {
                                    text: "Ok ✔️",
                                    callback_data: "confirm_txSignature",
                                  },
                                ],
                              ],
                            },
                          }
                        );
                      } else {
                        return isValidtxSignature(msg, publicKey);
                      }
                    } else {
                      return isValidtxSignature(msg, publicKey);
                    }
                  } else {
                    return isValidtxSignature(msg, publicKey);
                  }
                }
              }
            } catch (error) {
              console.log("Error during transaction validation:", error);
            }
          }
        );
      });
  } catch (error) {
    console.log("isValidtxSignatureError: ", error);
  }
};
