import { bot } from "../../bot";
import walletController from "../../controller/wallet";
import depositController from "../../controller/deposit";
import { checkSolBalance } from "../../service/getBalance";
import config from "../../config.json";
const { Connection, PublicKey } = require("@solana/web3.js");
const connection = new Connection(config.rpcUrl);
let tokenDepositInfo = {} as any;

export const depositHandler = async (
  msg: any,
  tokenAddress: any,
  Symbol: string,
  miniAmount: number
) => {
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: msg.chat.id, message_id: msg.message_id }
  );
  tokenDepositInfo = {};
  const user = await walletController.findOne({
    filter: {
      userId: msg.chat.id,
    },
  });

  bot
    .sendMessage(
      msg.chat.id,
      `
Please deposit to the following address and send <i>tx</i> link.
<b>Minimum Amount: </b> ${miniAmount}   
<b>Symbol: </b>  ${Symbol}
<code>${user.publicKey}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      }
    )
    .then((sentMessage) => {
      bot.onReplyToMessage(
        sentMessage.chat.id,
        sentMessage.message_id,
        async (reply) => {
          const txSignature = reply.text?.trim() as string;
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
            ].includes(txSignature)
          ) {
            return;
          }
          // Fetch the parsed transaction using the tx signature
          const tx = await connection.getParsedTransaction(txSignature);
          if (!tx || !tx.meta || !tx.transaction) {
            await isValidtxSignature(msg, user.publicKey, tokenAddress);
          } else {
            //Loop through the instructions to find the receiving address
            for (const instruction of tx.transaction.message.instructions) {
              if (
                instruction.programId.toString() ===
                "11111111111111111111111111111111"
              ) {
                // Native SOL transfer
                const parsedInstruction = instruction.parsed as any;
                const receiverAddress = parsedInstruction.info.destination;
                if (
                  user.publicKey === receiverAddress &&
                  tokenAddress == config.solTokenAddress
                ) {
                  tokenDepositInfo = {
                    tokenInfo: config.solTokenAddress,
                    userId: msg.chat.id,
                  };
                  bot.sendMessage(
                    msg.chat.id,
                    `
<b>Please check again.</b>
${txSignature}`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            { text: "Cancel ❌", callback_data: "return" },
                            {
                              text: "Ok ✔️",
                              callback_data: "inputToken_txSignature",
                            },
                          ],
                        ],
                      },
                    }
                  );
                } else {
                  await isValidtxSignature(msg, user.publicKey, tokenAddress);
                }
              } else if (
                instruction.programId.toString() ===
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
                    if (
                      !(user.publicKey === receiverAddress) ||
                      !(tokenAccount === tokenAddress)
                    ) {
                      await isValidtxSignature(
                        msg,
                        user.publicKey,
                        tokenAddress
                      );
                    } else {
                      tokenDepositInfo = {
                        tokenInfo: tokenAddress,
                        userId: msg.chat.id,
                      };
                      bot.sendMessage(
                        msg.chat.id,
                        `
<b>Please check again.</b>
${txSignature}`,
                        {
                          parse_mode: "HTML",
                          reply_markup: {
                            inline_keyboard: [
                              [
                                { text: "Cancel ❌", callback_data: "return" },
                                {
                                  text: "Ok ✔️",
                                  callback_data: "inputToken_txSignature",
                                },
                              ],
                            ],
                          },
                        }
                      );
                    }
                  } else {
                    bot.sendMessage(
                      msg.chat.id,
                      `
                                        <b>Failed to deposit.</b>
                                        ${txSignature}`,
                      {
                        parse_mode: "HTML",
                        reply_markup: {
                          inline_keyboard: [
                            [{ text: "Return  👈", callback_data: "return" }],
                          ],
                        },
                      }
                    );
                  }
                } else {
                  bot.sendMessage(
                    msg.chat.id,
                    `
                                    <b>Failed to deposit.</b>
                                    ${txSignature}`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [{ text: "Cancel ❌", callback_data: "return" }],
                        ],
                      },
                    }
                  );
                }
              }
            }
          }
        }
      );
    });
};

export const inputToken_txSignature = async (msg: any) => {
  const result = await depositController.create(tokenDepositInfo);
  if (result.status == 200) {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    bot.sendMessage(msg.chat.id, `Deposit is successfully compeleted`, {
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
      `
Deposit failed.

Please again.
`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Cancel  👈", callback_data: "return" }]],
        },
      }
    );
  } else if (result.status == 202) {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    bot.sendMessage(
      msg.chat.id,
      `
Token exist already.
`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      }
    );
  } else {
    bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    bot.sendMessage(
      msg.chat.id,
      `
Server has generated the error.

Please again later.
`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Cancel  👈", callback_data: "return" }]],
        },
      }
    );
  }
};

export const depositSolHandler = (
  msg: any,
  fee: number,
  walletPublicKey: string
) => {
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: msg.chat.id, message_id: msg.message_id }
  );
  bot
    .sendMessage(
      msg.chat.id,
      `
Please deposit to the following address and send <i>tx</i> link.
<b>Symbol: </b>  SOL
<b>Minimum Amount: </b> ${fee}   
<code>${walletPublicKey}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      }
    )
    .then((sentMessage) => {
      bot.onReplyToMessage(
        sentMessage.chat.id,
        sentMessage.message_id,
        async (reply) => {
          const txSignature = reply.text?.trim() as string;
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
            ].includes(txSignature)
          ) {
            return;
          }
          // Fetch the parsed transaction using the tx signature
          const tx = await connection.getParsedTransaction(txSignature);
          if (!tx || !tx.meta || !tx.transaction) {
            await isSolValidtxSignature(msg, fee, walletPublicKey);
          } else {
            //Loop through the instructions to find the receiving address
            for (const instruction of tx.transaction.message.instructions) {
              if (
                instruction.programId.toString() ===
                "11111111111111111111111111111111"
              ) {
                // Native SOL transfer
                const parsedInstruction = instruction.parsed as any;
                const receiverAddress = parsedInstruction.info.destination;
                if (walletPublicKey === receiverAddress) {
                  break;
                } else {
                  return isSolValidtxSignature(msg, fee, walletPublicKey);
                }
              }
            }
            const solAmount = await checkSolBalance(walletPublicKey);
            if (solAmount > fee) {
              bot.sendMessage(
                msg.chat.id,
                `
                            <b>Deposit is completed.</b>
                            ${txSignature}`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Return  👈", callback_data: "return" }],
                    ],
                  },
                }
              );
            } else {
              await isSolValidtxSignature(msg, fee, walletPublicKey);
            }
          }
        }
      );
    });
};

const isValidtxSignature = (msg: any, publicKey: string, tokenAddress: any) => {
  bot
    .sendMessage(
      msg.chat.id,
      `
        Please input valid tx link.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      }
    )
    .then((sentMessage) => {
      bot.onReplyToMessage(
        sentMessage.chat.id,
        sentMessage.message_id,
        async (reply) => {
          const txSignature = reply.text?.trim() as string;
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
            ].includes(txSignature)
          ) {
            return;
          }
          // Fetch the parsed transaction using the tx signature
          const tx = await connection.getParsedTransaction(txSignature);
          if (!tx || !tx.meta || !tx.transaction) {
            return isValidtxSignature(msg, publicKey, tokenAddress);
          }
          //Loop through the instructions to find the receiving address
          for (const instruction of tx.transaction.message.instructions) {
            if (
              instruction.programId.toString() ===
              "11111111111111111111111111111111"
            ) {
              // Native SOL transfer
              const parsedInstruction = instruction.parsed as any;
              const receiverAddress = parsedInstruction.info.destination;
              if (
                publicKey === receiverAddress &&
                tokenAddress == config.solTokenAddress
              ) {
                tokenDepositInfo = {
                  tokenInfo: config.solTokenAddress,
                  userId: msg.chat.id,
                };
                bot.sendMessage(
                  msg.chat.id,
                  `
<b>Please check again.</b>
${txSignature}`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          { text: "Cancel ❌", callback_data: "return" },
                          {
                            text: "Ok ✔️",
                            callback_data: "inputToken_txSignature",
                          },
                        ],
                      ],
                    },
                  }
                );
              } else {
                return isValidtxSignature(msg, publicKey, tokenAddress);
              }
            } else if (
              instruction.programId.toString() ===
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
                  if (
                    !(publicKey === receiverAddress) ||
                    !(tokenAccount === tokenAddress)
                  ) {
                    return isValidtxSignature(msg, publicKey, tokenAddress);
                  } else {
                    tokenDepositInfo = {
                      tokenInfo: tokenAddress,
                      userId: msg.chat.id,
                    };
                    bot.sendMessage(
                      msg.chat.id,
                      `
<b>Please check again.</b>
${txSignature}`,
                      {
                        parse_mode: "HTML",
                        reply_markup: {
                          inline_keyboard: [
                            [
                              { text: "Cancel ❌", callback_data: "return" },
                              {
                                text: "Ok ✔️",
                                callback_data: "inputToken_txSignature",
                              },
                            ],
                          ],
                        },
                      }
                    );
                  }
                } else {
                  bot.sendMessage(
                    msg.chat.id,
                    `
                                <b>Failed to deposit.</b>
                                ${txSignature}`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [{ text: "Return  👈", callback_data: "return" }],
                        ],
                      },
                    }
                  );
                }
              } else {
                bot.sendMessage(
                  msg.chat.id,
                  `
                            <b>Failed to deposit.</b>
                            ${txSignature}`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "Cancel ❌", callback_data: "return" }],
                      ],
                    },
                  }
                );
              }
            }
          }
        }
      );
    });
};

const isSolValidtxSignature = (
  msg: any,
  fee: number,
  walletPublicKey: string
) => {
  bot
    .sendMessage(
      msg.chat.id,
      `
Please input the valid tx link.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      }
    )
    .then((sentMessage) => {
      bot.onReplyToMessage(
        sentMessage.chat.id,
        sentMessage.message_id,
        async (reply) => {
          const txSignature = reply.text?.trim() as string;
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
            ].includes(txSignature)
          ) {
            return;
          }
          // Fetch the parsed transaction using the tx signature
          const tx = await connection.getParsedTransaction(txSignature);
          if (!tx || !tx.meta || !tx.transaction) {
            return isSolValidtxSignature(msg, fee, walletPublicKey);
          } else {
            //Loop through the instructions to find the receiving address
            for (const instruction of tx.transaction.message.instructions) {
              if (
                instruction.programId.toString() ===
                "11111111111111111111111111111111"
              ) {
                // Native SOL transfer
                const parsedInstruction = instruction.parsed as any;
                const receiverAddress = parsedInstruction.info.destination;
                if (walletPublicKey === receiverAddress) {
                  break;
                } else {
                  return isSolValidtxSignature(msg, fee, walletPublicKey);
                }
              }
            }
            const solAmount = await checkSolBalance(walletPublicKey);
            if (solAmount > config.minimumAmount) {
              bot.sendMessage(
                msg.chat.id,
                `
                            <b>Deposit is completed.</b>
                            ${txSignature}`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Return  👈", callback_data: "return" }],
                    ],
                  },
                }
              );
            } else {
              return isSolValidtxSignature(msg, fee, walletPublicKey);
            }
          }
        }
      );
    });
};
