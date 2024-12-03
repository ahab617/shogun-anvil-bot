import axios from "axios";
import { bot } from "../index";
import config from "../../config.json";
import { PublicKey } from "@solana/web3.js";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import { withdrawService } from "../../service";
import walletController from "../../controller/wallet";
import depositController from "../../controller/deposit";
import withdrawController from "../../controller/withdraw";
import { removeAnswerCallback } from "./index";

interface TwithdrawInfo {
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
}
let tokenAccount = {} as any;
let balanceAmount = {} as any;
let withdrawInfo = {} as any;

export const withdrawHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    if (user) {
      const tokenInfo = await depositController.findOne({
        filter: { userId: msg.chat.id },
      });
      try {
        let newArray = [];
        let newBalance = [];
        if (tokenInfo) {
          for (let i = 0; i < tokenInfo.tokenAddress.length; i++) {
            try {
              if (tokenInfo.tokenAddress[i] === config.solTokenAddress) {
                const balance = (await checkSolBalance(user.publicKey)) || 0;
                if (balance > 0) {
                  newBalance.push({
                    token: tokenInfo.tokenAddress[i],
                    balance: balance,
                  });
                  newArray.unshift([
                    {
                      text: `SOL  (${balance})`,
                      callback_data: `applyToken_${tokenInfo.tokenAddress[i]}`,
                    },
                  ]);
                }
              } else {
                const balance = (await checkSplTokenBalance(
                  tokenInfo.tokenAddress[i],
                  user.publicKey
                )) as number;
                if (balance > 0) {
                  const response = await axios(
                    `${config.dexAPI}/${tokenInfo.tokenAddress[i]}`
                  );
                  if (response?.status === 200 && response?.data?.pairs) {
                    const data = response.data.pairs[0];
                    newArray.push([
                      {
                        text: `${data.baseToken.name}  (${balance})`,
                        callback_data: `applyToken_${tokenInfo.tokenAddress[i]}`,
                      },
                    ]);
                    newBalance.push({
                      token: tokenInfo.tokenAddress[i],
                      balance: balance,
                    });
                  }
                }
              }
            } catch (err) {
              console.log(`Error processing token at index ${i}:`, err);
            }
          }
          tokenAccount[msg.chat.id] = {
            tokenInfo: newArray,
          };
          balanceAmount[msg.chat.id] = {
            balance: newBalance,
          };
          withdrawModal(msg);
        } else {
          const balance = (await checkSolBalance(user.publicKey)) || 0;
          if (balance == 0) {
            bot.sendMessage(msg.chat.id, `Please deposit in the wallet.`, {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Return  👈", callback_data: "return" }],
                ],
              },
            });
          } else {
            newBalance.push({
              token: config.solTokenAddress,
              balance: balance,
            });
            newArray.unshift([
              {
                text: `SOL  (${balance})`,
                callback_data: `applyToken_${config.solTokenAddress}`,
              },
            ]);
            tokenAccount[msg.chat.id] = {
              tokenInfo: newArray,
            };
            balanceAmount[msg.chat.id] = {
              balance: newBalance,
            };
          }
        }
      } catch (error) {
        console.log("Error occurred while processing user wallet:", error);
      }
    } else {
      bot.sendMessage(msg.chat.id, `Please connect the wallet.`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      });
    }
  } catch (error) {
    console.log("withdrawHandlerError: ", error);
  }
};

export const withdrawSelectHandler = async (msg: any, action: string | any) => {
  try {
    if (
      ![
        "/cancel",
        "/support",
        "/start",
        "/wallet",
        "/token",
        "/deposit",
        "/withdraw",
        "/balance",
        "/activity",
      ].includes(msg.text)
    ) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
    }
    const solBalance =
      balanceAmount[msg.chat.id]?.balance?.filter(
        (item: any) => item.token === config.solTokenAddress
      )[0]?.balance || "0";
    if (Number(solBalance) < config.withdrawFee) {
      bot.sendMessage(
        msg.chat.id,
        `
  Native Token Insufficient.
  Please deposit the SOL in your wallet.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[{ text: "👈 Return", callback_data: "return" }]],
          },
        }
      );
    } else {
      bot
        .sendMessage(
          msg.chat.id,
          `
  <b>Input Withdraw address</b>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (sentMessage) => {
          bot.onReplyToMessage(
            sentMessage.chat.id,
            sentMessage.message_id,
            async (reply) => {
              const walletAddress = reply.text?.trim() as string;
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
                ].includes(walletAddress)
              ) {
                return;
              }
              const tokenAddress = action.split("_")[1];
              const balance =
                balanceAmount[msg.chat.id]?.balance?.filter(
                  (item: any) => item.token === tokenAddress
                )[0]?.balance || "0";
              const isValidAddress = await isValidSolanaAddress(walletAddress);
              if (isValidAddress) {
                selectInputForm(msg, tokenAddress, balance, walletAddress);
              } else {
                promptForWithAddress(msg, tokenAddress, balance);
              }
            }
          );
        });
    }
  } catch (error) {
    console.log("withdrawSelectHandlerError: ", error);
  }
};

const withdrawModal = async (msg: any) => {
  try {
    tokenAccount[msg.chat.id]?.tokenInfo?.push([
      { text: "Return  👈", callback_data: "return" },
    ]);
    bot.sendMessage(
      msg.chat.id,
      `
  Select Withdraw Token
  `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: tokenAccount[msg.chat.id]?.tokenInfo,
        },
      }
    );
  } catch (error) {
    console.log("withdrawModalError: ", error);
  }
};

const promptForWithAddress = async (
  msg: any,
  tokenAddress: string,
  balance: number
) => {
  try {
    bot
      .sendMessage(
        msg.chat.id,
        `
<b>Input the valid withdraw address</b>
`,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const withdrawAddress = reply.text?.trim() as string;
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
              ].includes(withdrawAddress)
            ) {
              return;
            }
            const isValidAddress = isValidSolanaAddress(withdrawAddress);
            if (isValidAddress) {
              selectInputForm(msg, tokenAddress, balance, withdrawAddress);
            } else {
              return promptForWithAddress(msg, tokenAddress, balance);
            }
          }
        );
      });
  } catch (error) {
    console.log("promptForWithAddressError: ", error);
  }
};

const isValidSolanaAddress = (address: string) => {
  try {
    const pubKey = new PublicKey(address);
    return PublicKey.isOnCurve(pubKey.toBytes());
  } catch (error) {
    console.log("isValidSolanaAddressError: ", error);
  }
};

const selectInputForm = async (
  msg: any,
  tokenAddress: string,
  balance: number,
  walletAddress: string
) => {
  try {
    bot.sendMessage(
      msg.chat.id,
      `
<b>Current Balance: </b> ${balance}
<b>Network Fee: </b> ${config.withdrawFee} SOL
  `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "All",
                callback_data: `amountAll_${tokenAddress}_${walletAddress}`,
              },
              {
                text: "Some",
                callback_data: `amountSome_${tokenAddress}_${walletAddress}`,
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("selectInputFormError: ", error);
  }
};

export const allWithdrawHandler = async (msg: any, action: string) => {
  const user = await walletController.findOne({
    filter: {
      userId: msg.chat.id,
    },
  });
  try {
    const tokenAddress = action.split("_")[1];
    const walletAddress = action.split("_")[2];
    const balance =
      balanceAmount[msg.chat.id]?.balance?.filter(
        (item: any) => item.token === tokenAddress
      )[0]?.balance || "0";
    if (
      ![
        "/cancel",
        "/support",
        "/start",
        "/wallet",
        "/token",
        "/deposit",
        "/withdraw",
        "/balance",
        "/activity",
      ].includes(msg.text)
    ) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
    }
    if (tokenAddress === config.solTokenAddress) {
      withdrawInfo[msg.chat.id] = {
        userId: msg.chat.id,
        withdrawAddress: walletAddress,
        token: tokenAddress,
        amount: balance - config.withdrawFee,
        privateKey: user.privateKey,
      } as TwithdrawInfo;
    } else {
      withdrawInfo[msg.chat.id] = {
        userId: msg.chat.id,
        withdrawAddress: walletAddress,
        token: tokenAddress,
        amount: balance,
        privateKey: user.privateKey,
      } as TwithdrawInfo;
    }
    bot.sendMessage(
      msg.chat.id,
      `
<b>To: </b> <code>${walletAddress}</code>
<b>From: </b> <code>${user.publicKey}</code>
<b>Token Address: </b>  ${tokenAddress}
<b>Amount: </b>  ${withdrawInfo[msg.chat.id]?.amount}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👈 Return",
                callback_data: "return",
              },
              {
                text: "✔️ Apply",
                callback_data: "withdraw_apply",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("allWithdrawHandlerError: ", error);
  }
};
export const applyWithdrawHandler = async (msg: any) => {
  try {
    if (
      ![
        "/cancel",
        "/support",
        "/start",
        "/wallet",
        "/token",
        "/deposit",
        "/withdraw",
        "/balance",
        "/activity",
      ].includes(msg.text)
    ) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
    }
    const result = await withdrawService(withdrawInfo[msg.chat.id]);
    if (result) {
      bot.sendMessage(
        msg.chat.id,
        `
<b>Please check this.</b>
<a href="${config.solScanUrl}/${result}"><i>View on Solscan</i></a>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Return  👈", callback_data: "return" }],
            ],
          },
        }
      );
      await withdrawController.create([withdrawInfo[msg.chat.id]]);
    }
  } catch (error) {
    console.log("applyWithdrawHandlerError: ", error);
  }
};

export const someWithdrawHandler = async (msg: any, action: string) => {
  const user = await walletController.findOne({
    filter: {
      userId: msg.chat.id,
    },
  });
  try {
    const tokenAddress = action.split("_")[1];
    const walletAddress = action.split("_")[2];
    const balance =
      balanceAmount[msg.chat.id]?.balance.filter(
        (item: any) => item.token === tokenAddress
      )[0]?.balance || "0";
    if (
      ![
        "/cancel",
        "/support",
        "/start",
        "/wallet",
        "/token",
        "/deposit",
        "/withdraw",
        "/balance",
        "/activity",
      ].includes(msg.text)
    ) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
    }
    bot
      .sendMessage(
        msg.chat.id,
        `
<b>Input Withdraw amount</b>
<b>Current Balance: </b> ${balance}
  `,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const withdrawAmount = reply.text?.trim() as string;
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
              ].includes(withdrawAmount)
            ) {
              return;
            }
            const isValidBalance = await isValidAmount(
              msg,
              withdrawAmount,
              tokenAddress
            );
            if (isValidBalance) {
              withdrawInfo[msg.chat.id] = {
                userId: sentMessage.chat.id,
                withdrawAddress: walletAddress,
                token: tokenAddress,
                amount: Number(withdrawAmount),
                privateKey: user.privateKey,
              };
              bot.sendMessage(
                msg.chat.id,
                `
<b>To: </b> <code>${walletAddress}</code>
<b>From: </b> <code>${user.publicKey}</code>
<b>Token Address: </b>  ${tokenAddress}
<b>Amount: </b>  ${withdrawAmount}`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "👈 Return",
                          callback_data: "return",
                        },
                        {
                          text: "✔️ Apply",
                          callback_data: "withdraw_apply",
                        },
                      ],
                    ],
                  },
                }
              );
            } else {
              promptForWithdraw(msg, tokenAddress, balance, walletAddress);
            }
          }
        );
      });
  } catch (error) {
    console.log("someWithdrawHandlerError: ", error);
  }
};

const isValidAmount = async (
  msg: any,
  amount: string,
  tokenAddress: string
) => {
  const balance = balanceAmount[msg.chat.id]?.balance?.filter(
    (item: any) => item.token === tokenAddress
  )[0]?.balance;
  if (Number(amount) <= balance) {
    return true;
  } else {
    return false;
  }
};

const promptForWithdraw = async (
  msg: any,
  tokenAddress: string,
  balance: number,
  walletAddress: string
) => {
  const user = await walletController.findOne({
    filter: {
      userId: msg.chat.id,
    },
  });
  try {
    bot
      .sendMessage(
        msg.chat.id,
        `
<b>Input valid Withdraw amount</b>
<b>Current Balance: </b> ${balance}
`,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const withdrawAmount = reply.text?.trim() as string;
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
              ].includes(withdrawAmount)
            ) {
              return;
            }
            // Whether walletAddress is a solana address or not.
            const isValidBalance = await isValidAmount(
              msg,
              withdrawAmount,
              tokenAddress
            );
            if (isValidBalance) {
              withdrawInfo[msg.chat.id] = {
                userId: msg.chat.id,
                withdrawAddress: walletAddress,
                token: tokenAddress,
                amount: Number(withdrawAmount),
                privateKey: user.privateKey,
              };
              bot.sendMessage(
                msg.chat.id,
                `
<b>To: </b> <code>${walletAddress}</code>
<b>From: </b> <code>${user.publicKey}</code>
<b>Token Address: </b>  ${tokenAddress}
<b>Amount: </b>  ${withdrawAmount}`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "👈 Return",
                          callback_data: "return",
                        },
                        {
                          text: "✔️ Apply",
                          callback_data: "withdraw_apply",
                        },
                      ],
                    ],
                  },
                }
              );
            } else {
              return promptForWithdraw(
                msg,
                tokenAddress,
                balance,
                walletAddress
              );
            }
          }
        );
      });
  } catch (error) {
    console.log("promptForWithdrawError: ", error);
  }
};
