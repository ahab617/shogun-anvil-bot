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

let swapInfo = {} as any;
let swapSettingInfo = {} as any;
let minimumAmount = config.minimumAmount;
let gasFee = config.networkFee;
let dataInfo = {} as any;
let swapTokenInfo = {} as any;
export const swapHandler = async (msg: any) => {
  try {
    removeAnswerCallback(msg.chat);
    const tokenInfo = await tokenSettingController.findOne({
      filter: { userId: msg.chat.id },
    });
    swapTokenInfo[msg.chat.id] = await swapController.findOne({
      filter: { userId: msg.chat.id },
    });
    const walletInfo = await walletController.findOne({
      filter: { userId: msg.chat.id },
    });

    if (!walletInfo) {
      await bot.sendMessage(msg.chat.id, `Create the your wallet.`, {});
      return;
    }
    if (swapTokenInfo[msg.chat.id]?.status == 404) {
      try {
        if (tokenInfo) {
          let walletPublicKey = walletInfo?.publicKey;
          let data = tokenInfo.pairInfo;
          const shortened = await shortenString(data[0].pairAddress, 6, 6);
          const balance = await checkSolBalance(walletPublicKey);
          let SelectCoinInfo = [];
          if (balance) {
            dataInfo[msg.chat.id] = {
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
            };
            SelectCoinInfo.push([
              {
                text: `SOL (${balance}) -> ${tokenInfo.symbol} (${data[0].outLiquidity})   ${shortened}`,
                callback_data: `selectCoin`,
              },
            ]);
            swapInfo[msg.chat.id] = {
              selectInfo: SelectCoinInfo,
            };
          } else {
            bot.sendMessage(msg.chat.id, `Please Enter the Native Token.`);
            return;
          }
          swapModal(msg);
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
    } else if (swapTokenInfo[msg.chat.id]?.status == 200) {
      const activeOption = swapTokenInfo[msg.chat.id].data.active
        ? [[{ text: "Stop", callback_data: "swap_stop" }]]
        : [[{ text: "Active", callback_data: "swap_active" }]];
      await bot.sendMessage(
        msg.chat.id,
        `Swap information already exists.
<b>BaseToken: </b> ${swapTokenInfo[msg.chat.id].data.baseToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.baseName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo[msg.chat.id].data.quoteToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo[msg.chat.id].data.amount} 
<b>LoopTime: </b> ${swapTokenInfo[msg.chat.id].data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo[msg.chat.id].data.buy} 
<b>Sell times: </b> ${swapTokenInfo[msg.chat.id].data.sell}
  `,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              ...activeOption,
              [
                { text: "👈 Return", callback_data: "return" },
                { text: "Reset ", callback_data: "swap_delete" },
              ],
            ],
          },
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
export const swapDeleteHandler = async (msg: any) => {
  try {
    const chatId = msg.chat.id;
    const r = await swapController.deleteOne({
      filter: { userId: chatId },
    });
    if (r) {
      await bot.sendMessage(chatId, `Delete is completed successfully.`, {
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
      await bot.sendMessage(chatId, `Delete failed. Please try again later.`, {
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
  } catch (error) {
    console.error("Error swap setting: ", error);
  }
};

export const swapStopHandler = async (msg: any) => {
  try {
    const chatId = msg.chat.id;
    const r = {
      userId: swapTokenInfo[msg.chat.id].data.userId,
      active: false,
    };
    await swapController.updateOne(r);
    await bot.deleteMessage(chatId, msg.message_id as number);
    await bot.sendMessage(
      chatId,
      `
<b>BaseToken: </b> ${swapTokenInfo[msg.chat.id].data.baseToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.baseName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo[msg.chat.id].data.quoteToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo[msg.chat.id].data.amount} 
<b>LoopTime: </b> ${swapTokenInfo[msg.chat.id].data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo[msg.chat.id].data.buy} 
<b>Sell times: </b> ${swapTokenInfo[msg.chat.id].data.sell}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Active", callback_data: "swap_active" }],
            [
              { text: "👈 Return", callback_data: "return" },
              { text: "Reset ", callback_data: "swap_delete" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("swapStopHandler error:", error);
  }
};

export const swapActiveHandler = async (msg: any) => {
  try {
    const chatId = msg.chat.id;
    const r = {
      userId: swapTokenInfo[msg.chat.id].data.userId,
      active: true,
    };
    await swapController.updateOne(r);
    await bot.deleteMessage(chatId, msg?.message_id as number);
    await bot.sendMessage(
      chatId,
      `
<b>BaseToken: </b> ${swapTokenInfo[msg.chat.id].data.baseToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.baseName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.baseSymbol}

<b>QuoteToken: </b> ${swapTokenInfo[msg.chat.id].data.quoteToken}
<b>Name: </b>  ${swapTokenInfo[msg.chat.id].data.quoteName}
<b>Symbol: </b>  ${swapTokenInfo[msg.chat.id].data.quoteSymbol}

<b>Swap Amount:: </b> ${swapTokenInfo[msg.chat.id].data.amount} 
<b>LoopTime: </b> ${swapTokenInfo[msg.chat.id].data.loopTime} mins
<b>Buy times: </b> ${swapTokenInfo[msg.chat.id].data.buy} 
<b>Sell times: </b> ${swapTokenInfo[msg.chat.id].data.sell}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Stop", callback_data: "swap_stop" }],
            [
              { text: "👈 Return", callback_data: "return" },
              { text: "Reset ", callback_data: "swap_delete" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("swapActiveHandler error:", error);
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
      await bot.editMessageReplyMarkup(
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
              isValidTime(msg);
            } else {
              const loopTime = Number(time);
              BuyAndSellInput(msg, loopTime);
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
              { text: "OK ", callback_data: "swap_delete" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.log("swapConfirmHandlerError: ", error);
  }
};

const BuyAndSellInput = async (msg: any, time: number) => {
  try {
    const newText =
      `Choose Buy/Sell ratio: 2 buys to 1 sell EG. 2_1\n` +
      `Note: keep it simple. 2_1 , 1_1, 3_2\n`;
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
              return isValidBuyAndSell(msg.chat.id, time);
            } else {
              const BuyAndSellNumber = {
                buyNumber: Number(InputNumber.split("_")[0]),
                sellNumber: Number(InputNumber.split("_")[1]),
              } as TBuyAndSell;
              await SwapAmountHandler(msg.chat.id, time, BuyAndSellNumber);
            }
          }
        );
      });
  } catch (error) {
    console.log("BuyAndSellInputError: ", error);
  }
};

const swapModal = async (msg: any) => {
  swapInfo[msg.chat.id]?.selectInfo.push([
    { text: "Return  👈", callback_data: "return" },
  ]);
  await bot.sendMessage(msg.chat.id, `<b>Select Coin.</b>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: swapInfo[msg.chat.id]?.selectInfo,
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
              return isValidTime(msg);
            } else {
              const loopTime = Number(time);
              BuyAndSellInput(msg, loopTime);
            }
          }
        );
      });
  } catch (error) {
    console.log("isValidTimeError: ", error);
  }
};
const isValidBuyAndSell = async (chatId: any, time: number) => {
  try {
    const newText = `Please enter the valid type.\n\n` + `ex: 3_5`;
    await bot
      .sendMessage(chatId, newText, {
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
              return isValidBuyAndSell(chatId, time);
            } else {
              const BuyAndSellNumber = {
                buyNumber: Number(InputNumber.split("_")[0]),
                sellNumber: Number(InputNumber.split("_")[1]),
              } as TBuyAndSell;
              await SwapAmountHandler(chatId, time, BuyAndSellNumber);
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

const SwapAmountHandler = async (
  chatId: any,
  time: number,
  BuyAndSellNumber: TBuyAndSell
) => {
  try {
    if (dataInfo[chatId].inBalance < minimumAmount + gasFee) {
      await bot.sendMessage(
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
      await bot.sendMessage(
        chatId,
        `
Enter the Amount per trade In Sol minimum ${minimumAmount}
<b>Current Balance: </b> ${dataInfo[chatId].inBalance} SOL`,
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
                dataInfo[chatId].inBalance <
                  Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                promptSwapAmount(chatId, time, BuyAndSellNumber);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(dataInfo[chatId].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                swapSettingInfo[chatId] = {
                  baseToken: dataInfo[chatId].inToken,
                  baseSymbol: dataInfo[chatId].inSymbol,
                  baseName: dataInfo[chatId].inName,
                  baseBalance: dataInfo[chatId].inBalance,
                  quoteToken: dataInfo[chatId].outToken,
                  quoteSymbol: dataInfo[chatId].outSymbol,
                  quoteName: dataInfo[chatId].outName,
                  quoteBalance: dataInfo[chatId].outBalance,
                  pairAddress: dataInfo[chatId].pairAddress,
                  amount: Number(amountSol),
                  userId: chatId,
                  baseDecimal: baseDecimal,
                  quoteDecimal: dataInfo[chatId].decimal,
                  loopTime: time,
                  buy: BuyAndSellNumber?.buyNumber,
                  sell: BuyAndSellNumber?.sellNumber,
                };
                priorityFeeInput(chatId);
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

const promptSwapAmount = async (
  chatId: any,
  time: number,
  BuyAndSellNumber: any
) => {
  try {
    await bot.sendMessage(
      chatId,
      `
  <b>Current Balance: </b> ${dataInfo[chatId].inBalance}  ${dataInfo[chatId].inSymbol}`,
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
                dataInfo[chatId].inBalance <
                  Number(amountSol) + config.networkFee ||
                minimumAmount > Number(amountSol)
              ) {
                promptSwapAmount(sentMessage.chat.id, time, BuyAndSellNumber);
              } else {
                const info = await connection.getParsedAccountInfo(
                  new PublicKey(dataInfo[chatId].inToken)
                );
                const baseDecimal = info?.value?.data?.parsed?.info?.decimals;
                swapSettingInfo[chatId] = {
                  baseToken: dataInfo[chatId].inToken,
                  baseSymbol: dataInfo[chatId].inSymbol,
                  baseName: dataInfo[chatId].inName,
                  baseBalance: dataInfo[chatId].inBalance,
                  quoteToken: dataInfo[chatId].outToken,
                  quoteName: dataInfo[chatId].outName,
                  quoteSymbol: dataInfo[chatId].outSymbol,
                  quoteBalance: dataInfo[chatId].outBalance,
                  pairAddress: dataInfo[chatId].pairAddress,
                  amount: Number(amountSol),
                  userId: sentMessage.chat.id,
                  baseDecimal: baseDecimal,
                  quoteDecimal: dataInfo[chatId].decimal,
                  loopTime: time,
                  buy: BuyAndSellNumber?.buyNumber,
                  sell: BuyAndSellNumber?.sellNumber,
                };
                priorityFeeInput(chatId);
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

const priorityFeeInput = async (chatId: number) => {
  await bot.sendMessage(chatId, `Please enter the priority fee for the swap.`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀   High",
            callback_data: "enterFee_high",
          },
        ],
        [
          {
            text: "🚈   Medium",
            callback_data: "enterFee_medium",
          },
        ],
        [
          {
            text: "🔄   Small",
            callback_data: "enterFee_small",
          },
        ],
        [
          {
            text: "👈   Return",
            callback_data: "return",
          },
        ],
      ],
    },
  });
};
export const enterFeeHandler = async (msg: any, action: string) => {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: msg.chat.id, message_id: msg.message_id }
    );
    const chatId = msg.chat.id;
    const status = action.split("_")[1];
    swapSettingInfo[msg.chat.id] = {
      ...swapSettingInfo[msg.chat.id],
      priorityFee: status,
    };
    const r = await swapController.create(swapSettingInfo[msg.chat.id]);
    if (r) {
      await bot.sendMessage(
        chatId,
        `
✅  <b>Swap is valid.</b>
                
<b>BaseToken Address: </b>  ${swapSettingInfo[chatId].baseToken}
<b>Name: </b>  ${swapSettingInfo[chatId].baseName}
<b>Symbol: </b>  ${swapSettingInfo[chatId].baseSymbol}
<b>Balance: </b>  ${swapSettingInfo[chatId].baseBalance}
        
<b>QuoteToken Address: </b>  ${swapSettingInfo[chatId].quoteToken}
<b>Name: </b>  ${swapSettingInfo[chatId].quoteName}
<b>Symbol: </b>  ${swapSettingInfo[chatId].quoteSymbol}
<b>Balance: </b>  ${swapSettingInfo[chatId].quoteBalance}
        
<b>PairAddress:</b>  ${swapSettingInfo[chatId].pairAddress}
<b>LoopTime:</b>  ${swapSettingInfo[chatId].loopTime} mins
<b>Buy times</b>  ${swapSettingInfo[chatId]?.buy}
<b>Sell times</b>  ${swapSettingInfo[chatId]?.sell}
<b>Swap Amount: </b>  ${swapSettingInfo[chatId].amount}
<b>Priority Fee: </b> ${swapSettingInfo[chatId].priorityFee}
  `,
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
                  callback_data: "agree_swap_delete",
                },
              ],
            ],
          },
        }
      );
    }
  } catch (error) {
    console.log("enterFeeHandlerError: ", error);
  }
};
