import { bot } from "../index";
import config from "../../config.json";
import { checkSolBalance } from "../../service/getBalance";
import { clusterApiUrl } from "@solana/web3.js";
import { removeAnswerCallback } from "./index";
import swapController from "../../controller/swap";
import walletController from "../../controller/wallet";
import tokenSettingController from "../../controller/tokenSetting";

const { PublicKey, Connection } = require("@solana/web3.js");
const connection = new Connection(clusterApiUrl("mainnet-beta"), {
  commitment: "confirmed",
  wsEndpoint: "wss://api.mainnet-beta.solana.com",
});

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
      bot.sendMessage(msg.chat.id, `Create the your wallet.`, {});
      return;
    }
    if (swapTokenInfo?.status == 404) {
      try {
        if (tokenInfo) {
          walletPublicKey = walletInfo?.publicKey;
          let data = tokenInfo.pairInfo;
          const shortened = await shortenString(data[0].pairAddress, 6, 6);
          const balance = await checkSolBalance(walletPublicKey);
          if (balance) {
            await data1.push({
              inToken: data[0]?.inToken,
              inName: data[0]?.inName,
              inSymbol: data[0].inSymbol,
              inBalance: balance,
              outToken: tokenInfo.publicKey,
              outBalance: data[0].outLiquidity,
              outName: tokenInfo.name,
              outSymbol: tokenInfo.symbol,
              pairAddress: data[0].pairAddress,
              decimal: tokenInfo.decimal,
            });
            await swapInfo.push([
              {
                text: `SOL (${balance}) -> ${tokenInfo.symbol} (${data[0].outLiquidity})   ${shortened}`,
                callback_data: `selectCoin`,
              },
            ]);
          } else {
            bot.sendMessage(msg.chat.id, `Please enter the Native Token.`);
            return;
          }
          await swapModal(msg);
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
            bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: msg.chat.id, message_id: msg.message_id }
            );
          }
          bot.sendMessage(
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
      bot.sendMessage(
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
<b>Buy times: </b> ${swapTokenInfo.data.buy} 
<b>Sell times: </b> ${swapTokenInfo.data.sell}
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

      bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
        const action = callbackQuery.data;
        const chatId = callbackQuery.message?.chat.id as number;
        if (action?.startsWith("delete_swap")) {
          const r = await swapController.deleteOne({
            filter: { userId: chatId },
          });
          if (r) {
            bot.sendMessage(chatId, `Delete is completed successfully.`, {
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
            });
          } else {
            bot.sendMessage(chatId, `Delete failed. Please try again later.`, {
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
            });
          }
        } else if (action?.startsWith("stop_swap")) {
          const r = {
            userId: swapTokenInfo.data.userId,
            active: false,
          };
          await swapController.updateOne(r);
          bot.deleteMessage(
            chatId,
            callbackQuery.message?.message_id as number
          );
          bot.sendMessage(
            chatId,
            `
          Swap information already exists.
<b>BaseToken: </b> ${swapTokenInfo.data.baseToken}
<b>Name: </b>  ${swapTokenInfo.data.baseName}
<b>Symbol: </b>  ${swapTokenInfo.data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo.data.quoteToken}
<b>Name: </b>  ${swapTokenInfo.data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo.data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo.data.amount} 
<b>LoopTime: </b> ${swapTokenInfo.data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo.data.buy} 
<b>Sell times: </b> ${swapTokenInfo.data.sell}`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Active", callback_data: "active_swap" }],
                  [
                    { text: "👈 Return", callback_data: "return" },
                    { text: "Reset ", callback_data: "delete_swap" },
                  ],
                ],
              },
            }
          );
        } else if (action?.startsWith("active_swap")) {
          const r = {
            userId: swapTokenInfo.data.userId,
            active: true,
          };
          await swapController.updateOne(r);
          bot.deleteMessage(
            chatId,
            callbackQuery.message?.message_id as number
          );
          bot.sendMessage(
            chatId,
            `
          Swap information already exists.
<b>BaseToken: </b> ${swapTokenInfo.data.baseToken}
<b>Name: </b>  ${swapTokenInfo.data.baseName}
<b>Symbol: </b>  ${swapTokenInfo.data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo.data.quoteToken}
<b>Name: </b>  ${swapTokenInfo.data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo.data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo.data.amount} 
<b>LoopTime: </b> ${swapTokenInfo.data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo.data.buy} 
<b>Sell times: </b> ${swapTokenInfo.data.sell}`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Stop", callback_data: "stop_swap" }],
                  [
                    { text: "👈 Return", callback_data: "return" },
                    { text: "Reset ", callback_data: "delete_swap" },
                  ],
                ],
              },
            }
          );
        }
      });
    } else {
      bot.sendMessage(msg.chat.id, `${swapTokenInfo?.message}`, {
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

export const swapSettingHandler = async (msg: any) => {
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
    const newText =
      `Time between trades (mins) EG. 5\n` +
      `Note: this can be 5, 10 even 60\n`;
    await bot
      .sendMessage(msg.chat.id, newText, {
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
              isValidTime(msg);
            } else {
              loopTime = time;
              BuyAndSellInput(msg);
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
    bot.sendMessage(
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
    bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
      const action = callbackQuery.data;
      const chatId = callbackQuery.message?.chat.id as number;
      if (action?.startsWith("delete_swap")) {
        const r = await swapController.deleteOne({
          filter: { userId: chatId },
        });
        if (r) {
          bot.sendMessage(chatId, `Delete is completed successfully.`, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👈 Return", callback_data: "return" }],
              ],
            },
          });
        } else {
          bot.sendMessage(chatId, `Delete failed. Please try again later.`, {
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
          });
        }
      }
    });
  } catch (error) {
    console.log("swapConfirmHandlerError: ", error);
  }
};

const BuyAndSellInput = async (msg: any) => {
  try {
    const newText =
      `Choose Buy/Sell ratio: 2 buys to 1 sell EG. 2_1\n` +
      `Note: keep it simple. 2_1 , 1_1, 3_2\n`;
    bot
      .sendMessage(msg.chat.id, newText, {
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
              return isValidBuyAndSell(msg.chat.id);
            } else {
              BuyAndSellNumber.buyNumber = InputNumber.split("_")[0];
              BuyAndSellNumber.sellNumber = InputNumber.split("_")[1];
              await SwapAmountHandler(msg.chat.id);
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
  bot.sendMessage(msg.chat.id, `<b>Select Coin.</b>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: swapInfo,
    },
  });
};
const isValidTime = async (msg: any) => {
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
        bot.onReplyToMessage(
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
              return isValidTime(msg);
            } else {
              loopTime = time;
              await BuyAndSellInput(msg);
            }
          }
        );
      });
  } catch (error) {
    console.log("isValidTimeError: ", error);
  }
};
const isValidBuyAndSell = async (chatId: any) => {
  try {
    const newText = `Please enter the valid type.\n\n` + `ex: 3_5`;
    bot
      .sendMessage(chatId, newText, {
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
              return isValidBuyAndSell(chatId);
            } else {
              BuyAndSellNumber.buyNumber = InputNumber.split("_")[0];
              BuyAndSellNumber.sellNumber = InputNumber.split("_")[1];
              await SwapAmountHandler(chatId);
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

const SwapAmountHandler = async (chatId: any) => {
  try {
    if (data1[0].inBalance < minimumAmount + gasFee) {
      bot.sendMessage(
        chatId,
        `
Wallet Insufficient funds
<b>Minimum Amount: </b> ${minimumAmount + gasFee} SOL
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
    } else {
      bot.sendMessage(
        chatId,
        `
Enter the Amount per trade In Sol minimum ${minimumAmount}
<b>Current Balance: </b> ${data1[0].inBalance} SOL`,
        { parse_mode: "HTML" }
      );
    }

    await bot
      .sendMessage(
        chatId,
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
        bot.onReplyToMessage(
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
                data1[0].inBalance < Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                await promptSwapAmount(chatId);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(data1[0].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                let swapTokenInfo = {
                  baseToken: data1[0].inToken,
                  baseSymbol: data1[0].inSymbol,
                  baseName: data1[0].inName,
                  baseBalance: data1[0].inBalance,
                  quoteToken: data1[0].outToken,
                  quoteSymbol: data1[0].outSymbol,
                  quoteName: data1[0].outName,
                  quoteBalance: data1[0].outBalance,
                  pairAddress: data1[0].pairAddress,
                  amount: Number(amountSol),
                  userId: chatId,
                  baseDecimal: baseDecimal,
                  quoteDecimal: data1[0].decimal,
                  loopTime: loopTime,
                  buy: BuyAndSellNumber.buyNumber,
                  sell: BuyAndSellNumber.sellNumber,
                };
                const r = await swapController.create(swapTokenInfo);
                if (r) {
                  bot.sendMessage(
                    chatId,
                    `
  ✅  <b>Swap is valid.</b>
                  
  <b>BaseToken Address:</b>  ${data1[0].inToken}
  <b>Name: </b>  ${data1[0].inName}
  <b>Symbol:</b>  ${data1[0].inSymbol}
  <b>Balance:</b>  ${data1[0].inBalance}
          
  <b>QuoteToken Address:</b>  ${data1[0].outToken}
  <b>Name: </b>  ${data1[0].outName}
  <b>Symbol:</b>  ${data1[0].outSymbol}
  <b>Balance:</b>  ${data1[0].outBalance}
          
  <b>PairAddress:</b>  ${data1[0].pairAddress}
  <b>LoopTime:</b>  ${loopTime} mins
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

const promptSwapAmount = async (chatId: any) => {
  try {
    bot.sendMessage(
      chatId,
      `
  <b>Current Balance: </b> ${data1[0].inBalance}  ${data1[0].inSymbol}`,
      { parse_mode: "HTML" }
    );
    await bot
      .sendMessage(
        chatId,
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
        bot.onReplyToMessage(
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
                data1[0].inBalance < Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                await promptSwapAmount(sentMessage.chat.id);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(data1[0].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                let swapTokenInfo = {
                  baseToken: data1[0].inToken,
                  baseSymbol: data1[0].inSymbol,
                  baseName: data1[0].inName,
                  baseBalance: data1[0].inBalance,
                  quoteToken: data1[0].outToken,
                  quoteName: data1[0].outName,
                  quoteSymbol: data1[0].outSymbol,
                  quoteBalance: data1[0].outBalance,
                  pairAddress: data1[0].pairAddress,
                  amount: Number(amountSol),
                  userId: sentMessage.chat.id,
                  baseDecimal: baseDecimal,
                  quoteDecimal: data1[0].decimal,
                  loopTime: loopTime,
                  buy: BuyAndSellNumber.buyNumber,
                  sell: BuyAndSellNumber.sellNumber,
                };
                const r = await swapController.create(swapTokenInfo);
                if (r) {
                  bot.sendMessage(
                    sentMessage.chat.id,
                    `
  ✅  <b>Swap is valid.</b>
                  
  <b>BaseToken Address: </b>  ${data1[0].inToken}
  <b>Name: </b>  ${data1[0].inName}
  <b>Symbol: </b>  ${data1[0].inSymbol}
  <b>Balance: </b>  ${data1[0].inBalance}
          
  <b>QuoteToken Address: </b>  ${data1[0].outToken}
  <b>Name: </b>  ${data1[0].outName}
  <b>Symbol: </b>  ${data1[0].outSymbol}
  <b>Balance: </b>  ${data1[0].outBalance}
          
  <b>PairAddress:</b>  ${data1[0].pairAddress}
  <b>LoopTime:</b>  ${loopTime} mins
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
