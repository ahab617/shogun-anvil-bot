import { bot } from "../bot";
import { apiSwap } from "./swap";
import swapInfoController from "../controller/swap";
import { convertTokenAmount } from "../service/getTokenPrice";
import { depositSolHandler } from "./callback/deposit";
import { checkSolBalance, checkSplTokenBalance } from "../service/getBalance";
import depositController from "../controller/deposit";
import config from "../config.json";
const cron = require("node-cron");
let timeAmount = 0;

export const startSwapProcess = async () => {
  timeAmount = 0;
  cron.schedule("*/1 * * * *", () => {
    processSwap(1);
  });
};

const executeSwap = async (userList: any) => {
  const {
    amount,
    baseDecimal,
    quoteDecimal,
    baseSymbol,
    quoteSymbol,
    baseToken,
    quoteToken,
    swapDetails,
    userId,
    buy,
    sell,
    buyProgress,
    sellProgress,
    flag,
    isBalance,
  } = userList;
  try {
    if (buyProgress < buy && flag) {
      if (baseToken === config.solTokenAddress) {
        const currentSolBalance = (await checkSolBalance(
          swapDetails[0].publicKey
        )) as number;
        if (currentSolBalance >= amount + config.networkFee) {
          const result = await apiSwap(
            Number(amount),
            baseDecimal,
            baseToken,
            quoteToken,
            swapDetails[0].privateKey
          );
          if (result?.status == 200) {
            bot.sendMessage(
              userId,
              `
You bought the token.\n 
Swap for ${Number(amount)} ${baseSymbol} -> ${quoteSymbol}
<a href="${config.solScanUrl}/${result.txId}"><i>View on Solscan</i></a>`,
              { parse_mode: "HTML" }
            );
            const depositToken = {
              userId: userId,
              tokenInfo: quoteToken,
            };
            await depositController.create(depositToken);
            const newBuyProgress = buyProgress + 1;
            let swapInfoUpdate = null;
            if (buy == newBuyProgress) {
              swapInfoUpdate = {
                userId: userId,
                buyProgress: 0,
                flag: false,
                isBalance: true,
              };
            } else {
              swapInfoUpdate = {
                userId: userId,
                buyProgress: newBuyProgress,
                flag: true,
                isBalance: true,
              };
            }
            await swapInfoController.updateOne(swapInfoUpdate);
          } else {
            return;
          }
        } else {
          if (isBalance) {
            const value = amount + config.networkFee - currentSolBalance;
            await inputTokenCheck(userId, baseToken, baseSymbol, value);
            const swapInfoUpdate = {
              userId: userId,
              isBalance: false,
            };
            await swapInfoController.updateOne(swapInfoUpdate);
          } else {
            return;
          }
        }
      } else {
        const currentTokenBalance = (await checkSplTokenBalance(
          baseToken,
          swapDetails[0].publicKey
        )) as number;

        if (currentTokenBalance >= amount) {
          const result = await apiSwap(
            Number(amount),
            baseDecimal,
            baseToken,
            quoteToken,
            swapDetails[0].privateKey
          );
          if (result?.status == 200) {
            bot.sendMessage(
              userId,
              `
You bought the token.\n
Reserve Swap for ${Number(amount)} ${baseSymbol} -> ${quoteSymbol}
<a href="${config.solScanUrl}/${result.txId}"><i>View on Solscan</i></a>`,
              { parse_mode: "HTML" }
            );
            const depositToken = {
              userId: userId,
              tokenInfo: quoteToken,
            };
            await depositController.create(depositToken);
            const newBuyProgress = buyProgress + 1;
            let swapInfoUpdate = null;
            if (buy == newBuyProgress) {
              swapInfoUpdate = {
                userId: userId,
                buyProgress: 0,
                flag: false,
                isBalance: true,
              };
            } else {
              swapInfoUpdate = {
                userId: userId,
                buyProgress: newBuyProgress,
                flag: true,
                isBalance: true,
              };
            }
            await swapInfoController.updateOne(swapInfoUpdate);
          } else {
            return;
          }
        } else {
          if (isBalance) {
            const value = amount - currentTokenBalance;
            await inputTokenCheck(userId, baseToken, baseSymbol, value);
            const swapInfoUpdate = {
              userId: userId,
              isBalance: false,
            };
            await swapInfoController.updateOne(swapInfoUpdate);
          } else {
            return;
          }
        }
      }
    } else if (sellProgress < sell && !flag) {
      const currentTokenBalance =
        (await checkSplTokenBalance(quoteToken, swapDetails[0].publicKey)) || 0;

      const amount1 =
        (await convertTokenAmount(amount, baseToken, quoteToken)) || 0;
      if (amount1 > currentTokenBalance || currentTokenBalance == 0) {
        if (isBalance) {
          const realAmount = Math.floor(amount1);
          const value = realAmount - currentTokenBalance;
          await inputTokenCheck(userId, quoteToken, quoteSymbol, value);
          const swapInfoUpdate = {
            userId: userId,
            isBalance: false,
          };
          await swapInfoController.updateOne(swapInfoUpdate);
        } else {
          return;
        }
      } else {
        const result = await apiSwap(
          Number(parseFloat(amount1.toString()).toFixed(4)),
          quoteDecimal,
          quoteToken,
          baseToken,
          swapDetails[0].privateKey
        );
        if (result?.status == 200) {
          bot.sendMessage(
            userId,
            `
You sold the token.
Reverse swap for ${Number(
              parseFloat(amount1.toString()).toFixed(4)
            )} ${quoteSymbol} -> ${baseSymbol}
<a href="${config.solScanUrl}/${result.txId}">View on Solscan</a>`,
            { parse_mode: "HTML" }
          );
          const newSellProgress = sellProgress + 1;
          let swapInfoUpdate = null;
          if (sell == newSellProgress) {
            swapInfoUpdate = {
              userId: userId,
              sellProgress: 0,
              flag: true,
              isBalance: true,
            };
          } else {
            swapInfoUpdate = {
              userId: userId,
              sellProgress: newSellProgress,
              flag: false,
              isBalance: true,
            };
          }
          await swapInfoController.updateOne(swapInfoUpdate);
        } else {
          return;
        }
      }
    } else {
      return;
    }
  } catch (error) {
    console.error("Error executing swap:", error);
  }
};

const processSwapForUserList = async (userList: any) => {
  const { swapDetails, userId } = userList;
  try {
    const currentBalance = (await checkSolBalance(
      swapDetails[0].publicKey
    )) as number;
    if (currentBalance < config.networkFee) {
      await bot.sendMessage(
        userId,
        `
You have not the native token enough.
<b>Network Fee: </b>  ${config.networkFee} SOL
`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Return 👈", callback_data: "return" },
                { text: "Deposit", callback_data: "deposit_Sol" },
              ],
            ],
          },
        }
      );

      await bot.on(
        "callback_query",
        async function onCallbackQuery(callbackQuery) {
          const action = callbackQuery.data;
          if (action?.startsWith("deposit_Sol")) {
            await depositSolHandler(
              callbackQuery.message,
              config.networkFee,
              swapDetails[0].publicKey
            );
          }
        }
      );
      return;
    }
    await executeSwap(userList);
  } catch (error) {
    console.error("Error fetching swap info:", error);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

const processSwap = async (interval: number) => {
  try {
    if (timeAmount > 1440) {
      timeAmount = 0;
    }
    timeAmount += interval;
    const swapInfo = await swapInfoController.swapInfo();
    if (swapInfo?.data.length > 0) {
      for (let i = 0; i < swapInfo.data.length; i++) {
        if (
          swapInfo.data[i].active &&
          timeAmount % swapInfo.data[i].loopTime == 0
        ) {
          await processSwapForUserList(swapInfo.data[i]);
        }
      }
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching swap info:", error);
  }
};

const inputTokenCheck = async (
  userId: number,
  tokenAddress: any,
  Symbol: string,
  miniAmount: number
) => {
  await bot.sendMessage(
    userId,
    `
You have not the ${Symbol} token amount enough.
<b>Required ${Symbol} Amount: </b> ${miniAmount}
Command Line:  /deposit
`,
    {}
  );
};
