import { bot } from "../index";
import {
  checkSolBalance,
  checkSplTokenBalance,
} from "../../service/getBalance";
import tokenSettingController from "../../controller/tokenSetting";
import depositController from "../../controller/deposit";
import walletController from "../../controller/wallet";
import swapController from "../../controller/swap";
import { convertTokenAmount } from "../../service/getTokenPrice";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
const { PublicKey, Connection } = require("@solana/web3.js");
const connection = new Connection(config.rpcUrl);

interface TBuyAndSell {
  buyNumber: number;
  sellNumber: number;
}

let data1 = [] as any;
let swapInfo = [] as any;
let walletPublicKey = "";
let minimumAmount = config.minimumAmount;
let gasFee = config.networkFee;
let loopTime = 0;
let BuyAndSellNumber: TBuyAndSell = {
  buyNumber: 0,
  sellNumber: 0,
};

export const swapHandler = async (msg: any) => {
  try {
    await removeAnswerCallback(msg.chat);
    data1 = [];
    swapInfo = [];
    loopTime = 0;
    BuyAndSellNumber.buyNumber = 0;
    BuyAndSellNumber.sellNumber = 0;
    const tokenInfo = await tokenSettingController.findOne({
      filter: { userId: msg.chat.id },
    });
    const swapTokenInfo = await swapController.findOne({
      filter: { userId: msg.chat.id },
    });
    const walletInfo = await walletController.findOne({
      filter: { userId: msg.chat.id },
    });

    if (!walletInfo) {
      await bot.sendMessage(msg.chat.id, `Create the your wallet.`, {});
      return;
    }
    if (swapTokenInfo?.status == 404) {
      try {
        if (tokenInfo) {
          const depositToken = await depositController.findOne({
            filter: { userId: msg.chat.id },
          });
          walletPublicKey = walletInfo?.publicKey;
          if (
            depositToken &&
            depositToken.tokenAddress.includes(config.solTokenAddress)
          ) {
            let data = tokenInfo.pairInfo;
            for (let i = 0; i < data.length; i++) {
              const shortened = await shortenString(data[i].pairAddress, 6, 6);
              if (data[i]?.inToken === config.solTokenAddress) {
                const balance = await checkSolBalance(walletPublicKey);
                await data1.push({
                  inToken: data[i]?.inToken,
                  inName: data[i]?.inName,
                  inSymbol: data[i].inSymbol,
                  inBalance: balance,
                  outToken: tokenInfo.publicKey,
                  outBalance: data[i].outLiquidity,
                  outName: tokenInfo.name,
                  outSymbol: tokenInfo.symbol,
                  pairAddress: data[i].pairAddress,
                  decimal: tokenInfo.decimal,
                });
                await swapInfo.push([
                  {
                    text: `SOL (${balance}) -> ${tokenInfo.symbol} (${data[i].outLiquidity})   ${shortened}`,
                    callback_data: `selectCoin_${data1.length - 1}`,
                  },
                ]);
              } else if (depositToken.tokenAddress.includes(data[i].inToken)) {
                const balance = await checkSplTokenBalance(
                  data[i]?.inToken,
                  walletPublicKey
                );
                await data1.push({
                  inToken: data[i]?.inToken,
                  inName: data[i]?.inName,
                  inSymbol: data[i].inSymbol,
                  inBalance: balance,
                  outToken: tokenInfo.publicKey,
                  outBalance: data[i].outLiquidity,
                  outName: tokenInfo.name,
                  outSymbol: tokenInfo.symbol,
                  pairAddress: data[i].pairAddress,
                  decimal: tokenInfo.decimal,
                });
                await swapInfo.push([
                  {
                    text: `${data[i]?.inSymbol} (${balance}) -> ${tokenInfo.symbol} (${data[i].outLiquidity})   ${shortened}`,
                    callback_data: `selectCoin_${data1.length - 1}`,
                  },
                ]);
              } else continue;
            }
            await swapModal(msg);
          } else {
            await bot.sendMessage(
              msg.chat.id,
              `
You need the <b>Native token (SOL)</b> to swap. 
<b>Command Line: </b> /deposit`,
              {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "👈 Return",
                        callback_data: "return",
                      },
                    ],
                  ],
                },
              }
            );
            return;
          }
        } else {
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
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: msg.chat.id, message_id: msg.message_id }
            );
          }
          await bot.sendMessage(
            msg.chat.id,
            `
Please set the token to swap
<b>Command Line: </b> /token `,
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
      } catch (error) {
        console.error("Error in token swapping logic:", error);
      }
    } else if (swapTokenInfo?.status == 200) {
      const activeOption = swapTokenInfo.data.active
        ? [[{ text: "Stop", callback_data: "stop_swap" }]]
        : [[{ text: "Active", callback_data: "active_swap" }]];
      await bot.sendMessage(
        msg.chat.id,
        `Swap information already exists.
<b>BaseToken: </b> ${swapTokenInfo.data.baseToken}
<b>Name: </b>  ${swapTokenInfo.data.baseName}
<b>Symbol: </b>  ${swapTokenInfo.data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo.data.quoteToken}
<b>Name: </b>  ${swapTokenInfo.data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo.data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo.data.amount} 
<b>LoopTime: </b> ${swapTokenInfo.data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo.data.buy} mins
<b>Sell times: </b> ${swapTokenInfo.data.sell} mins
  `,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              ...activeOption,
              [
                { text: "👈 Return", callback_data: "return" },
                { text: "Reset ", callback_data: "delete_swap" },
              ],
            ],
          },
        }
      );

      await bot.on(
        "callback_query",
        async function onCallbackQuery(callbackQuery) {
          const action = callbackQuery.data;
          const chatId = callbackQuery.message?.chat.id as number;
          if (action?.startsWith("delete_swap")) {
            const r = await swapController.deleteOne({
              filter: { userId: chatId },
            });
            if (r) {
              await bot.sendMessage(
                chatId,
                `Delete is completed successfully.`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "👈 Return",
                          callback_data: "return",
                        },
                      ],
                    ],
                  },
                }
              );
            } else {
              await bot.sendMessage(
                chatId,
                `Delete failed. Please try again later.`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "👈 Return",
                          callback_data: "return",
                        },
                      ],
                    ],
                  },
                }
              );
            }
          } else if (action?.startsWith("stop_swap")) {
            const r = {
              userId: swapInfo.data.userId,
              active: false,
            };
            await swapController.updateOne(r);
          } else if (action?.startsWith("active_swap")) {
            const r = {
              userId: swapInfo.data.userId,
              active: true,
            };
            await swapController.updateOne(r);
          }
        }
      );
    } else {
      await bot.sendMessage(msg.chat.id, `${swapTokenInfo?.message}`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "👈 Return", callback_data: "return" }]],
        },
      });
    }
  } catch (error) {
    console.error("Error swap setting: ", error);
  }
};

export const swapSettingHandler = async (msg: any, action: any) => {
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
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: msg.chat.id, message_id: msg.message_id }
      );
    }
    const idx = Number(action.split("_")[1]);
    await bot
      .sendMessage(
        msg.chat.id,
        `
  Time between trades (mins) EG. 5
  Note: this can be 5, 10 even 60 `,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const time = reply.text?.trim() as any;
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
              ].includes(time)
            ) {
              return;
            }
            if (!Number.isInteger(Number(time)) || Number(time) < 1) {
              isValidTime(msg, idx);
            } else {
              loopTime = time;
              BuyAndSellInput(msg, idx);
            }
          }
        );
      });
  } catch (error) {
    console.log("swapSettingHandlerError: ", error);
  }
};

export const swapConfirmHandler = async (msg: any) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      `
  Do you really want to delete this swap?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👈 Return", callback_data: "return" },
              { text: "OK ", callback_data: "delete_swap" },
            ],
          ],
        },
      }
    );
    await bot.on(
      "callback_query",
      async function onCallbackQuery(callbackQuery) {
        const action = callbackQuery.data;
        const chatId = callbackQuery.message?.chat.id as number;
        if (action?.startsWith("delete_swap")) {
          const r = await swapController.deleteOne({
            filter: { userId: chatId },
          });
          if (r) {
            await bot.sendMessage(chatId, `Delete is completed successfully.`, {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "👈 Return", callback_data: "return" }],
                ],
              },
            });
          } else {
            await bot.sendMessage(
              chatId,
              `Delete failed. Please try again later.`,
              {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "👈 Return",
                        callback_data: "return",
                      },
                    ],
                  ],
                },
              }
            );
          }
        }
      }
    );
  } catch (error) {
    console.log("swapConfirmHandlerError: ", error);
  }
};

const BuyAndSellInput = async (msg: any, idx: number) => {
  try {
    const newText = `
    Choose Buy/Sell ratio: 2 buys to 1 sell EG. 2_1
    Note: keep it simple. 2_1 , 1_1, 3_2`;
    await bot
      .sendMessage(msg.chat.id, newText, {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      })
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const InputNumber = reply.text?.trim() as any;
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
              ].includes(InputNumber)
            ) {
              return;
            }
            if (
              InputNumber.indexOf("_") === -1 ||
              InputNumber.split("_").length !== 2 ||
              Number.isInteger(InputNumber.split("_")[0]) ||
              Number.isInteger(InputNumber.split("_")[1])
            ) {
              return isValidBuyAndSell(msg, idx);
            } else {
              BuyAndSellNumber.buyNumber = InputNumber.split("_")[0];
              BuyAndSellNumber.sellNumber = InputNumber.split("_")[1];
              await SwapAmountHandler(msg, idx);
            }
          }
        );
      });
  } catch (error) {
    console.log("BuyAndSellInputError: ", error);
  }
};

const swapModal = async (msg: any) => {
  await swapInfo.push([{ text: "Return  👈", callback_data: "return" }]);
  await bot.sendMessage(msg.chat.id, `<b>Select Coin.</b>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: swapInfo,
    },
  });
};
const isValidTime = async (msg: any, idx: number) => {
  try {
    const newText = `Please enter the valid number type(>1).`;
    await bot
      .sendMessage(msg.chat.id, newText, {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      })
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const time = reply.text?.trim() as any;
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
              ].includes(time)
            ) {
              return;
            }
            if (!Number.isInteger(Number(time)) || Number(time) < 1) {
              return isValidTime(msg, idx);
            } else {
              loopTime = time;
              await BuyAndSellInput(msg, idx);
            }
          }
        );
      });
  } catch (error) {
    console.log("isValidTimeError: ", error);
  }
};
const isValidBuyAndSell = async (msg: any, idx: number) => {
  try {
    const newText = `Please enter the valid type.\n\n` + `ex: 3_5`;
    bot
      .sendMessage(msg.chat.id, newText, {
        parse_mode: "HTML",
        reply_markup: {
          force_reply: true,
        },
      })
      .then((sentMessage) => {
        bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const InputNumber = reply.text?.trim() as any;
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
              ].includes(InputNumber)
            ) {
              return;
            }
            if (
              InputNumber.indexOf("_") === -1 ||
              InputNumber.split("_").length !== 2 ||
              Number.isInteger(InputNumber.split("_")[0]) ||
              Number.isInteger(InputNumber.split("_")[1])
            ) {
              return isValidBuyAndSell(msg, idx);
            } else {
              BuyAndSellNumber.buyNumber = InputNumber.split("_")[0];
              BuyAndSellNumber.sellNumber = InputNumber.split("_")[1];
              await SwapAmountHandler(msg, idx);
            }
          }
        );
      });
  } catch (error) {
    console.log("isValidBuyAndSellError: ", error);
  }
};
const shortenString = async (
  str: string,
  startLength: number,
  endLength: number
) => {
  if (str.length <= startLength + endLength) {
    return str;
  }
  return str.slice(0, startLength) + "..." + str.slice(str.length - endLength);
};

const SwapAmountHandler = async (msg: any, idx: number) => {
  try {
    if (data1[idx].inToken == config.solTokenAddress) {
      if (data1[idx].inBalance < minimumAmount + gasFee) {
        await bot.sendMessage(
          msg.chat.id,
          `
  Wallet Insufficient funds
  <b>Minimum Amount: </b> ${minimumAmount + gasFee} SOL
  <b>Command Line: </b> /deposit`,
          { parse_mode: "HTML" }
        );
        return;
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `
  Enter the Amount per trade In Sol minimum ${minimumAmount}
  <b>Current Balance: </b> ${data1[idx].inBalance} SOL`,
          { parse_mode: "HTML" }
        );
      }
    } else {
      const currentBalance = (await checkSolBalance(walletPublicKey)) as number;
      const convertSplToSolBalance =
        (await convertTokenAmount(
          minimumAmount,
          config.solTokenAddress,
          data1[idx].inToken
        )) || 0;
      if (
        data1[idx].inBalance < convertSplToSolBalance ||
        currentBalance < gasFee
      ) {
        await bot.sendMessage(
          msg.chat.id,
          `
  Wallet Insufficient funds.
  <b>Minimum Swap Amount: </b> ${convertSplToSolBalance} 
  <b>Native token: </b> ${gasFee} SOL
  <b>Command Line: </b> /deposit`,
          { parse_mode: "HTML" }
        );
        return;
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `
  <b>Current Balance: </b> ${data1[idx].inBalance}  ${data1[idx].inSymbol}`,
          { parse_mode: "HTML" }
        );
      }
    }

    await bot
      .sendMessage(
        msg.chat.id,
        `
  <b> Enter the Per trade amount (SOL)</b> `,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            try {
              const amountSol = reply.text?.trim() as any;
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
                ].includes(amountSol)
              ) {
                return;
              }
              if (
                isNaN(amountSol) ||
                data1[idx].inBalance < Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                await promptSwapAmount(msg, idx);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(data1[idx].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                let swapTokenInfo = {
                  baseToken: data1[idx].inToken,
                  baseSymbol: data1[idx].inSymbol,
                  baseName: data1[idx].inName,
                  baseBalance: data1[idx].inBalance,
                  quoteToken: data1[idx].outToken,
                  quoteSymbol: data1[idx].outSymbol,
                  quoteName: data1[idx].outName,
                  quoteBalance: data1[idx].outBalance,
                  pairAddress: data1[idx].pairAddress,
                  amount: Number(amountSol),
                  userId: msg.chat.id,
                  baseDecimal: baseDecimal,
                  quoteDecimal: data1[idx].decimal,
                  loopTime: loopTime,
                  buy: BuyAndSellNumber.buyNumber,
                  sell: BuyAndSellNumber.sellNumber,
                };
                const r = await swapController.create(swapTokenInfo);
                if (r) {
                  await bot.sendMessage(
                    msg.chat.id,
                    `
  ✅  <b>Swap is valid.</b>
                  
  <b>BaseToken Address:</b>  ${data1[idx].inToken}
  <b>Name: </b>  ${data1[idx].inName}
  <b>Symbol:</b>  ${data1[idx].inSymbol}
  <b>Balance:</b>  ${data1[idx].inBalance}
          
  <b>QuoteToken Address:</b>  ${data1[idx].outToken}
  <b>Name: </b>  ${data1[idx].outName}
  <b>Symbol:</b>  ${data1[idx].outSymbol}
  <b>Balance:</b>  ${data1[idx].outBalance}
          
  <b>PairAddress:</b>  ${data1[idx].pairAddress}
  <b>LoopTime:</b>  ${loopTime}
  <b>Buy times</b>  ${BuyAndSellNumber.buyNumber}
  <b>Sell times</b>  ${BuyAndSellNumber.sellNumber}
  <b>Swap Amount:</b>  ${Number(amountSol)}`,
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
                              text: "Delete ",
                              callback_data: "agree_delete_swap",
                            },
                          ],
                        ],
                      },
                    }
                  );
                }
              }
            } catch (error) {
              console.error("Error swap amount setting:", error);
            }
          }
        );
      });
  } catch (error) {
    console.log("SwapAmountHandlerError: ", error);
  }
};

const promptSwapAmount = async (msg: any, idx: number) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      `
  <b>Current Balance: </b> ${data1[idx].inBalance}  ${data1[idx].inSymbol}`,
      { parse_mode: "HTML" }
    );
    await bot
      .sendMessage(
        msg.chat.id,
        `
   <b> Enter the Per trade amount (SOL)</b> `,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            try {
              const amountSol = reply.text?.trim() as any;
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
                ].includes(amountSol)
              ) {
                return;
              }
              if (
                isNaN(amountSol) ||
                data1[idx].inBalance < Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                await promptSwapAmount(msg, idx);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(data1[idx].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                let swapTokenInfo = {
                  baseToken: data1[idx].inToken,
                  baseSymbol: data1[idx].inSymbol,
                  baseName: data1[idx].inName,
                  baseBalance: data1[idx].inBalance,
                  quoteToken: data1[idx].outToken,
                  quoteName: data1[idx].outName,
                  quoteSymbol: data1[idx].outSymbol,
                  quoteBalance: data1[idx].outBalance,
                  pairAddress: data1[idx].pairAddress,
                  amount: Number(amountSol),
                  userId: msg.chat.id,
                  baseDecimal: baseDecimal,
                  quoteDecimal: data1[idx].decimal,
                  loopTime: loopTime,
                  buy: BuyAndSellNumber.buyNumber,
                  sell: BuyAndSellNumber.sellNumber,
                };
                const r = await swapController.create(swapTokenInfo);
                if (r) {
                  await bot.sendMessage(
                    msg.chat.id,
                    `
  ✅  <b>Swap is valid.</b>
                  
  <b>BaseToken Address: </b>  ${data1[idx].inToken}
  <b>Name: </b>  ${data1[idx].inName}
  <b>Symbol: </b>  ${data1[idx].inSymbol}
  <b>Balance: </b>  ${data1[idx].inBalance}
          
  <b>QuoteToken Address: </b>  ${data1[idx].outToken}
  <b>Name: </b>  ${data1[idx].outName}
  <b>Symbol: </b>  ${data1[idx].outSymbol}
  <b>Balance: </b>  ${data1[idx].outBalance}
          
  <b>PairAddress:</b>  ${data1[idx].pairAddress}
  <b>LoopTime:</b>  ${loopTime}
  <b>Buy times</b>  ${BuyAndSellNumber.buyNumber}
  <b>Sell times</b>  ${BuyAndSellNumber.sellNumber}
  <b>Swap Amount: </b>  ${Number(amountSol)}`,
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
                              text: "Delete ",
                              callback_data: "agree_delete_swap",
                            },
                          ],
                        ],
                      },
                    }
                  );
                }
              }
            } catch (error) {
              console.error("Error swap amount prompt:", error);
            }
          }
        );
      });
  } catch (error) {
    console.log("promptSwapAmountError: ", error);
  }
};
