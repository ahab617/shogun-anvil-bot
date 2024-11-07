import { bot } from "../index";
import { PublicKey } from "@solana/web3.js";
import depositController from "../../controller/deposit";
import walletController from "../../controller/wallet";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import { withdrawService } from "../../service";
import config from "../../config.json";
import axios from "axios";
import { removeAnswerCallback } from "./index";
interface TwithdrawInfo {
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
}
let tokenAccount = [] as any;
let userWalletAddress = "" as string;
let balanceAmount = [] as any;
let userBotWalletPrivateKey = "" as any;
let userBotWalletPublicKey = "" as any;
let withdrawInfo: TwithdrawInfo | null;
export const withdrawHandler = async (msg: any) => {
  removeAnswerCallback(msg.chat);
  tokenAccount = [];
  userWalletAddress = "";
  balanceAmount = [];
  userBotWalletPrivateKey = "";
  userBotWalletPublicKey = "";
  withdrawInfo = null;
  const user = await walletController.findOne({
    filter: {
      userId: msg.chat.id,
    },
  });
  if (user) {
    userBotWalletPrivateKey = user.privateKey;
    userBotWalletPublicKey = user.publicKey;
    const tokenInfo = await depositController.findOne({
      filter: { userId: msg.chat.id },
    });
    try {
      if (tokenInfo) {
        for (let i = 0; i < tokenInfo.tokenAddress.length; i++) {
          try {
            if (tokenInfo.tokenAddress[i] === config.solTokenAddress) {
              // Check SOL balance
              const balance = await checkSolBalance(user.publicKey);
              if (balance > 0) {
                await balanceAmount.push({
                  token: tokenInfo.tokenAddress[i],
                  balance: balance,
                });
                await tokenAccount.unshift([
                  {
                    text: `SOL  (${balance})`,
                    callback_data: `applyToken_${tokenInfo.tokenAddress[i]}`,
                  },
                ]);
              }
            } else {
              // Check SPL token balance
              const balance = await checkSplTokenBalance(
                tokenInfo.tokenAddress[i],
                user.publicKey
              );
              if (balance > 0) {
                const response = await axios(
                  `${config.dexAPI}/${tokenInfo.tokenAddress[i]}`
                );
                if (response?.status === 200 && response?.data?.pairs) {
                  const data = response.data.pairs[0];
                  await tokenAccount.push([
                    {
                      text: `${data.baseToken.name}  (${balance})`,
                      callback_data: `applyToken_${tokenInfo.tokenAddress[i]}`,
                    },
                  ]);
                  await balanceAmount.push({
                    token: tokenInfo.tokenAddress[i],
                    balance: balance,
                  });
                }
              }
            }
          } catch (err) {
            console.error(`Error processing token at index ${i}:`, err);
          }
        }
        await withdrawModal(msg);
      } else {
        bot.sendMessage(msg.chat.id, `Please deposit in the wallet.`, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Return  👈", callback_data: "return" }],
            ],
          },
        });
      }
    } catch (error) {
      console.error("Error occurred while processing user wallet:", error);
    }
  } else {
    bot.sendMessage(msg.chat.id, `Please connect the wallet.`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Return  👈", callback_data: "return" }]],
      },
    });
  }
};

export const withdrawSelectHandler = async (msg: any, action: string | any) => {
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
    balanceAmount.filter(
      (item: any) => item.token === config.solTokenAddress
    )[0]?.balance || "0";
  if (Number(solBalance) < config.networkFee) {
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
      .then((sentMessage) => {
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
              balanceAmount.filter(
                (item: any) => item.token === tokenAddress
              )[0]?.balance || "0";
            const isValidAddress = await isValidSolanaAddress(walletAddress);
            if (isValidAddress) {
              userWalletAddress = walletAddress;
              await selectInputForm(msg, tokenAddress, balance);
            } else {
              await promptForWithAddress(msg, tokenAddress, balance);
            }
          }
        );
      });
  }
};

export const applyWithdrawHandler = async (msg: any) => {
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
  await withdrawService(withdrawInfo);
};
const withdrawModal = async (msg: any) => {
  tokenAccount.push([{ text: "Return  👈", callback_data: "return" }]);
  bot.sendMessage(
    msg.chat.id,
    `
Select Withdraw Token
`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: tokenAccount,
      },
    }
  );
};

const promptForWithAddress = (
  msg: any,
  tokenAddress: string,
  balance: number
) => {
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
    .then((sentMessage) => {
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
          const isValidAddress = await isValidSolanaAddress(withdrawAddress);
          if (isValidAddress) {
            await selectInputForm(msg, tokenAddress, balance);
          } else {
            return promptForWithAddress(msg, tokenAddress, balance);
          }
        }
      );
    });
};

const isValidSolanaAddress = (address: string) => {
  try {
    const pubKey = new PublicKey(address);
    return PublicKey.isOnCurve(pubKey.toBytes());
  } catch (error) {
    return false;
  }
};

const selectInputForm = (msg: any, tokenAddress: string, balance: number) => {
  bot.sendMessage(
    msg.chat.id,
    `
<b>Current Balance: </b> ${balance}
<b>Network Fee: </b> ${config.networkFee} SOL
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
};

export const allWithdrawHandler = async (msg: any, action: string) => {
  const tokenAddress = action.split("_")[1];
  const balance =
    balanceAmount.filter((item: any) => item.token === tokenAddress)[0]
      ?.balance || "0";
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
    withdrawInfo = {
      userId: msg.chat.id,
      withdrawAddress: userWalletAddress,
      token: tokenAddress,
      amount: balance - config.networkFee,
      privateKey: userBotWalletPrivateKey,
    } as TwithdrawInfo;
  } else {
    withdrawInfo = {
      userId: msg.chat.id,
      withdrawAddress: userWalletAddress,
      token: tokenAddress,
      amount: balance,
      privateKey: userBotWalletPrivateKey,
    } as TwithdrawInfo;
  }
  bot.sendMessage(
    msg.chat.id,
    `
<b>To: </b> <code>${userWalletAddress}</code>
<b>From: </b> <code>${userBotWalletPublicKey}</code>
<b>Token Address: </b>  ${tokenAddress}
<b>Amount: </b>  ${withdrawInfo?.amount}`,
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
};

export const someWithdrawHandler = async (msg: any, action: string) => {
  const tokenAddress = action.split("_")[1];
  const balance =
    balanceAmount.filter((item: any) => item.token === tokenAddress)[0]
      ?.balance || "0";
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
    .then((sentMessage) => {
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
            withdrawAmount,
            tokenAddress
          );
          if (isValidBalance) {
            withdrawInfo = {
              userId: sentMessage.chat.id,
              withdrawAddress: userWalletAddress,
              token: tokenAddress,
              amount: Number(withdrawAmount),
              privateKey: userBotWalletPrivateKey,
            };
            bot.sendMessage(
              msg.chat.id,
              `
<b>To: </b> <code>${userWalletAddress}</code>
<b>From: </b> <code>${userBotWalletPublicKey}</code>
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
            await promptForWithdraw(msg, tokenAddress, balance);
          }
        }
      );
    });
};

const isValidAmount = (amount: string, tokenAddress: string) => {
  const balance = balanceAmount.filter(
    (item: any) => item.token === tokenAddress
  )[0]?.balance;
  if (Number(amount) <= balance) {
    return true;
  } else {
    return false;
  }
};

const promptForWithdraw = (msg: any, tokenAddress: string, balance: number) => {
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
    .then((sentMessage) => {
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
            withdrawAmount,
            tokenAddress
          );
          if (isValidBalance) {
            withdrawInfo = {
              userId: msg.chat.id,
              withdrawAddress: userWalletAddress,
              token: tokenAddress,
              amount: Number(withdrawAmount),
              privateKey: userBotWalletPrivateKey,
            };
            bot.sendMessage(
              msg.chat.id,
              `
<b>To: </b> <code>${userWalletAddress}</code>
<b>From: </b> <code>${userBotWalletPublicKey}</code>
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
};
