import { bot } from "../index";
import config from "../../config.json";
import { PublicKey } from "@solana/web3.js";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import { withdrawService } from "../../service";
import walletController from "../../controller/wallet";
import withdrawController from "../../controller/withdraw";
import { removeAnswerCallback } from "./index";
import tokenSetting from "../../controller/tokenSetting";

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
let withdrawAddress = {} as any;
export const withdrawHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    const user = await walletController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });

    if (user) {
      const tokenInfo = await tokenSetting.findOne({
        filter: { userId: msg.chat.id },
      });

      try {
        let newArray = [];
        let newBalance = [];
        const solBalance = (await checkSolBalance(user.publicKey)) || 0;
        if (solBalance > 0) {
          newBalance.push({
            token: config.solTokenAddress,
            balance: solBalance,
          });
          newArray.unshift([
            {
              text: `SOL  (${solBalance})`,
              callback_data: `applyToken_${config.solTokenAddress}`,
            },
          ]);
        }
        if (tokenInfo) {
          try {
            const splTokenBalance =
              (await checkSplTokenBalance(
                tokenInfo.publicKey,
                user.publicKey
              )) || 0;
            if (splTokenBalance > 0) {
              newArray.push([
                {
                  text: `${tokenInfo.name}  (${splTokenBalance})`,
                  callback_data: `applyToken_${tokenInfo.publicKey}`,
                },
              ]);
              newBalance.push({
                token: tokenInfo.publicKey,
                balance: splTokenBalance,
              });
            }
          } catch (err) {
            console.log(`Error getting the SPL token balance:`, err);
          }
          tokenAccount[msg.chat.id] = {
            tokenInfo: newArray,
          };
          balanceAmount[msg.chat.id] = {
            balance: newBalance,
          };
          withdrawModal(msg);
        }
        if (newArray.length == 0 || newBalance.length == 0) {
          bot.sendMessage(msg.chat.id, `Please deposit in the wallet.`, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Return  👈", callback_data: "return" }],
              ],
            },
          });
          return;
        } else {
          tokenAccount[msg.chat.id] = {
            tokenInfo: newArray,
          };
          balanceAmount[msg.chat.id] = {
            balance: newBalance,
          };
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
                withdrawAddress[msg.chat.id] = {
                  address: walletAddress,
                };
                selectInputForm(msg, tokenAddress, balance);
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
              selectInputForm(msg, tokenAddress, balance);
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
  balance: number
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
                callback_data: `amountAll_${tokenAddress}`,
              },
              {
                text: "Some",
                callback_data: `amountSome_${tokenAddress}`,
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
        withdrawAddress: withdrawAddress[msg.chat.id].address,
        token: tokenAddress,
        amount: balance - config.withdrawFee,
        privateKey: user.privateKey,
      } as TwithdrawInfo;
    } else {
      withdrawInfo[msg.chat.id] = {
        userId: msg.chat.id,
        withdrawAddress: withdrawAddress[msg.chat.id].address,
        token: tokenAddress,
        amount: balance,
        privateKey: user.privateKey,
      } as TwithdrawInfo;
    }
    bot.sendMessage(
      msg.chat.id,
      `
<b>To: </b> <code>${withdrawAddress[msg.chat.id].address}</code>
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
      await withdrawController.create(withdrawInfo[msg.chat.id]);
    } else {
      bot.sendMessage(msg.chat.id, `Withdraw failed. Please try again later`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
        },
      });
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
                withdrawAddress: withdrawAddress[msg.chat.id].address,
                token: tokenAddress,
                amount: Number(withdrawAmount),
                privateKey: user.privateKey,
              };
              bot.sendMessage(
                msg.chat.id,
                `
<b>To: </b> <code>${withdrawAddress[msg.chat.id].address}</code>
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
              promptForWithdraw(msg, tokenAddress, balance);
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
  balance: number
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
                withdrawAddress: withdrawAddress[msg.chat.id].address,
                token: tokenAddress,
                amount: Number(withdrawAmount),
                privateKey: user.privateKey,
              };
              bot.sendMessage(
                msg.chat.id,
                `
<b>To: </b> <code>${withdrawAddress[msg.chat.id].address}</code>
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
              return promptForWithdraw(msg, tokenAddress, balance);
            }
          }
        );
      });
  } catch (error) {
    console.log("promptForWithdrawError: ", error);
  }
};
