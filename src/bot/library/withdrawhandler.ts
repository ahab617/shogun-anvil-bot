import { bot } from "../index";
import config from "../../config.json";
import {
  PublicKey,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import { estimateSOLTransferFee, withdrawService } from "../../service";
import walletController from "../../controller/wallet";
import { removeAnswerCallback, subBalance } from "./index";
import tokenSetting from "../../controller/tokenSetting";
import { getWalletTokenBalances } from "../../service";
import axios from "axios";
import { rentExemption } from "../../service/rentBalance";
const connection = new Connection(clusterApiUrl("mainnet-beta"), {
  commitment: "confirmed",
  wsEndpoint: "wss://api.mainnet-beta.solana.com",
});
interface TwithdrawInfo {
  userId: number;
  withdrawAddress: string;
  token: string;
  amount: number;
  privateKey: string;
}

interface TsplTokenInfo {
  address: string;
  decimals: number;
  amount: number;
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
        const solBalance = await checkSolBalance(user.publicKey);
        if (solBalance === undefined) {
          bot.sendMessage(
            msg.chat.id,
            `It failed to get balance due to network overload. Please try again later.`
          );
          return;
        } else if (solBalance > 0) {
          const r = await subBalance(solBalance);
          newBalance.push({
            token: config.solTokenAddress,
            balance: Number(r),
          });
          newArray.unshift([
            {
              text: `SOL  (${r})`,
              callback_data: `applyToken_${config.solTokenAddress}`,
            },
          ]);
        }

        const splTokenInfo = (await getWalletTokenBalances(
          user.publicKey
        )) as Array<TsplTokenInfo>;

        if (splTokenInfo.length > 0) {
          for (let i = 0; i < splTokenInfo.length; i++) {
            const r = await subBalance(splTokenInfo[i].amount);
            if (r !== 0) {
              const response = await axios.post(
                `${config.dexAPI}/${splTokenInfo[i].address}`
              );
              if (response?.status == 200 && response?.data?.pairs) {
                const tokenInfo = response.data.pairs[0].baseToken;

                newArray.push([
                  {
                    text: `${tokenInfo.name}  (${Number(r)})`,
                    callback_data: `applyToken_${splTokenInfo[i].address}`,
                  },
                ]);
                newBalance.push({
                  token: splTokenInfo[i].address,
                  balance: Number(r),
                });
              } else {
                bot.sendMessage(
                  msg.chat.id,
                  `It failed to get balance due to network overload. Please try again later.`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "Return 👈", callback_data: "return" }],
                      ],
                    },
                  }
                );
                return;
              }
            }
          }
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
          withdrawModal(msg);
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
                )[0]?.balance || 0;
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
            const walletAddress = reply.text?.trim() as string;
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
              ].includes(walletAddress)
            ) {
              return;
            }
            const isValidAddress = isValidSolanaAddress(walletAddress);
            if (isValidAddress) {
              withdrawAddress[msg.chat.id] = {
                address: walletAddress,
              };
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
    return null;
  }
};

const selectInputForm = async (
  msg: any,
  tokenAddress: string,
  balance: number
) => {
  try {
    const rentBalance = await rentExemption();
    if (!rentBalance) {
      bot.sendMessage(
        msg.chat.id,
        `Please try again later due to network overload.`
      );
      return;
    }
    bot.sendMessage(
      msg.chat.id,
      `
<b>Current Balance: </b> ${balance}
<b>Network Fee: </b> ${rentBalance} SOL
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
      )[0]?.balance || 0;
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
      const fee =
        (await estimateSOLTransferFee(
          user.publicKey,
          withdrawAddress[msg.chat.id].address,
          Number(balance)
        )) || 0;

      const rentBalance = await rentExemption();
      if (!rentBalance) {
        bot.sendMessage(
          msg.chat.id,
          `Please try again later due to network overload.`
        );
        return;
      }
      const r = await subBalance(balance - rentBalance);
      withdrawInfo[msg.chat.id] = {
        userId: msg.chat.id,
        withdrawAddress: withdrawAddress[msg.chat.id].address,
        token: tokenAddress,
        amount: Number(r),
        privateKey: user.privateKey,
      } as TwithdrawInfo;
    } else {
      const r = await subBalance(balance);
      withdrawInfo[msg.chat.id] = {
        userId: msg.chat.id,
        withdrawAddress: withdrawAddress[msg.chat.id].address,
        token: tokenAddress,
        amount: r,
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
    if (withdrawInfo[msg.chat.id]?.token == config.solTokenAddress) {
      if (result) {
        const newText = `<a href="${config.solScanUrl}/${result}"><i>View on Solscan</i></a>`;
        bot.sendMessage(msg.chat.id, newText, { parse_mode: "HTML" });
      } else {
        bot.sendMessage(
          msg.chat.id,
          `Please try again later due to network overload`,
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
    const r = await subBalance(balance);
    bot
      .sendMessage(
        msg.chat.id,
        `
<b>Input Withdraw amount</b>
<b>Current Balance: </b> ${r}
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
