import { bot } from "../bot";
import { apiSwap } from "./swap";
import config from "../config.json";
import swapInfoController from "../controller/swap";
import { checkSolBalance, checkSplTokenBalance } from "../service/getBalance";
import { delay } from "../service";

const cron = require("node-cron");
let timeAmount = 0;
let isSolStatus = {} as any;
export const startSwapProcess = async () => {
  timeAmount = 0;
  cron.schedule("*/1 * * * *", () => {
    processSwap(1);
  });
};

const executeSwap = async (userList: any) => {
  const {
    amount,
    amountToken,
    baseDecimal,
    baseBalance,
    quoteDecimal,
    baseSymbol,
    quoteSymbol,
    baseToken,
    quoteToken,
    quoteBalance,
    swapDetails,
    userId,
    buy,
    sell,
    buyProgress,
    sellProgress,
    flag,
    isBalance,
    priorityFee,
    dir,
  } = userList;
  try {
    if (dir == "one") {
      if (buyProgress < buy && flag) {
        if (baseToken === config.solTokenAddress) {
          const currentSolBalance = (await checkSolBalance(
            swapDetails[0].publicKey
          )) as any;
          if (currentSolBalance === undefined) return;
          let priorityFeeValue = 0;
          if (priorityFee === "high") {
            priorityFeeValue = 0.01;
          } else if (priorityFee === "medium") {
            priorityFeeValue = 0.003;
          } else {
            priorityFeeValue = 0.001;
          }
          if (currentSolBalance >= amount + priorityFeeValue) {
            const result = await apiSwap(
              Number(amount),
              baseDecimal,
              baseToken,
              quoteToken,
              swapDetails[0].privateKey,
              priorityFee
            );
            if (result?.status == 200 && result?.txId) {
              const newBuyProgress = buyProgress + 1;
              let swapInfoUpdate = {};
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
              bot.sendMessage(
                userId,
                `
You bought the token.\n 
Swap for ${Number(amount)} ${baseSymbol} -> ${quoteSymbol}
<a href="${config.solScanUrl}/${result.txId}"><i>View on Solscan</i></a>`,
                { parse_mode: "HTML" }
              );
            } else {
              return;
            }
          } else {
            if (isBalance) {
              const value = amount + priorityFeeValue - currentSolBalance;
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
          )) as any;
          if (currentTokenBalance === undefined) return;
          if (currentTokenBalance >= amount) {
            const result = await apiSwap(
              Number(amount),
              baseDecimal,
              baseToken,
              quoteToken,
              swapDetails[0].privateKey,
              priorityFee
            );
            if (result?.status == 200 && result?.txId) {
              const newBuyProgress = buyProgress + 1;
              let swapInfoUpdate = {};
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
              bot.sendMessage(
                userId,
                `
You bought the token.\n
Reserve Swap for ${Number(amount)} ${baseSymbol} -> ${quoteSymbol}
<a href="${config.solScanUrl}/${result.txId}"><i>View on Solscan</i></a>`,
                { parse_mode: "HTML" }
              );
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
        const currentTokenBalance = (await checkSplTokenBalance(
          quoteToken,
          swapDetails[0].publicKey
        )) as any;
        if (currentTokenBalance === undefined) return;
        if (amountToken > currentTokenBalance || currentTokenBalance == 0) {
          if (isBalance) {
            const value = amountToken - currentTokenBalance;
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
            amountToken,
            quoteDecimal,
            quoteToken,
            baseToken,
            swapDetails[0].privateKey,
            priorityFee
          );
          if (result?.status == 200 && result?.txId) {
            const newSellProgress = sellProgress + 1;
            let swapInfoUpdate = {};
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
            bot.sendMessage(
              userId,
              `
  You sold the token.
  Reverse swap for ${Number(amountToken)} ${quoteSymbol} -> ${baseSymbol}
  <a href="${config.solScanUrl}/${result.txId}">View on Solscan</a>`,
              { parse_mode: "HTML" }
            );
          } else {
            return;
          }
        }
      } else {
        return;
      }
    } else if (dir == "two") {
      if (flag && !isSolStatus[userId]?.isSol) {
        const currentSolBalance = (await checkSolBalance(
          swapDetails[0].publicKey
        )) as any;
        if (currentSolBalance === undefined) return;
        let priorityFeeValue = 0;
        if (priorityFee === "high") {
          priorityFeeValue = 0.01;
        } else if (priorityFee === "medium") {
          priorityFeeValue = 0.003;
        } else {
          priorityFeeValue = 0.001;
        }
        if (
          currentSolBalance <
          (amount + priorityFeeValue) * (buy - buyProgress) + priorityFeeValue
        ) {
          const currentTokenBalance = (await checkSplTokenBalance(
            quoteToken,
            swapDetails[0].publicKey
          )) as any;
          if (currentTokenBalance === undefined) return;
          if (currentTokenBalance < amountToken * buy) {
            if (isBalance) {
              const value = Number(
                parseFloat(
                  (
                    (amount + priorityFeeValue) * (buy - buyProgress) +
                    priorityFeeValue
                  ).toString()
                ).toFixed(4)
              );
              await inputTokenCheck(userId, baseToken, baseSymbol, value);
              const swapInfoUpdate = {
                userId: userId,
                isBalance: false,
              };
              await swapInfoController.updateOne(swapInfoUpdate);
              isSolStatusFunc(userId, false);
            } else {
              return;
            }
          } else {
            isSplTokenStatusFunc(userId, true);
            const swapInfoUpdate = {
              userId: userId,
              sellProgress: 0,
              buyProgress: 0,
              buy: sell,
              sell: buy,
              flag: false,
              isBalance: true,
            };
            await swapInfoController.updateOne(swapInfoUpdate);
            return;
          }
        } else {
          isSolStatusFunc(userId, true);
        }
      }

      if (!flag && !isSolStatus[userId]?.isSplToken) {
        const currentTokenBalance = (await checkSplTokenBalance(
          quoteToken,
          swapDetails[0].publicKey
        )) as any;
        if (currentTokenBalance === undefined) return;
        if (currentTokenBalance < amountToken * sell) {
          const currentSolBalance = (await checkSolBalance(
            swapDetails[0].publicKey
          )) as any;
          if (currentSolBalance === undefined) return;
          let priorityFeeValue = 0;
          if (priorityFee === "high") {
            priorityFeeValue = 0.01;
          } else if (priorityFee === "medium") {
            priorityFeeValue = 0.003;
          } else {
            priorityFeeValue = 0.001;
          }
          if (
            currentSolBalance <
            (amount + priorityFeeValue) * (sell - sellProgress) +
              priorityFeeValue
          ) {
            if (isBalance) {
              const value = Number(
                parseFloat(
                  (
                    (amount + priorityFeeValue) * buy +
                    priorityFeeValue
                  ).toString()
                ).toFixed(4)
              );
              await inputTokenCheck(userId, baseToken, baseSymbol, value);
              const swapInfoUpdate = {
                userId: userId,
                isBalance: false,
              };
              await swapInfoController.updateOne(swapInfoUpdate);
              isSolStatusFunc(userId, false);
            } else {
              return;
            }
          } else {
            const swapInfoUpdate = {
              userId: userId,
              sellProgress: 0,
              buyProgress: 0,
              buy: sell,
              sell: buy,
              flag: true,
              isBalance: true,
            };
            await swapInfoController.updateOne(swapInfoUpdate);
            isSolStatusFunc(userId, true);
            return;
          }
        } else {
          const currentSolBalance = (await checkSolBalance(
            swapDetails[0].publicKey
          )) as any;
          if (currentSolBalance == undefined) return;
          let priorityFeeValue = 0;
          if (priorityFee === "high") {
            priorityFeeValue = 0.01;
          } else if (priorityFee === "medium") {
            priorityFeeValue = 0.003;
          } else {
            priorityFeeValue = 0.001;
          }
          if (currentSolBalance < priorityFeeValue * sell) {
            if (isBalance) {
              const value = Number(
                parseFloat(
                  (priorityFeeValue * sell - currentSolBalance).toString()
                ).toFixed(4)
              );
              await inputTokenCheck(userId, baseToken, baseSymbol, value);
              const swapInfoUpdate = {
                userId: userId,
                isBalance: false,
              };
              await swapInfoController.updateOne(swapInfoUpdate);
            } else {
              return;
            }
          } else {
            isSplTokenStatusFunc(userId, true);
          }
        }
      }
      if (isSolStatus[userId]?.isSol && flag && buyProgress < buy) {
        console.log("buy swap start!");
        const result = await apiSwap(
          Number(amount),
          baseDecimal,
          baseToken,
          quoteToken,
          swapDetails[0].privateKey,
          priorityFee
        );
        if (result?.status == 200 && result?.txId) {
          console.log("buy success!");
          const newBuyProgress = buyProgress + 1;
          let swapInfoUpdate = {};
          if (buy == newBuyProgress) {
            isSplTokenStatusFunc(userId, false);
            isSolStatusFunc(userId, true);
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
          bot.sendMessage(
            userId,
            `
  You bought the token.\n 
  Swap for ${Number(amount)} ${baseSymbol} -> ${quoteSymbol}
  <a href="${config.solScanUrl}/${result.txId}"><i>View on Solscan</i></a>`,
            { parse_mode: "HTML" }
          );
        } else {
          return;
        }
      }
      if (isSolStatus[userId]?.isSplToken && sellProgress < sell && !flag) {
        console.log("sell swap start!");
        const result = await apiSwap(
          amountToken,
          quoteDecimal,
          quoteToken,
          baseToken,
          swapDetails[0].privateKey,
          priorityFee
        );
        if (result?.status == 200 && result?.txId) {
          console.log("sell success!");

          const newSellProgress = sellProgress + 1;
          let swapInfoUpdate = {};
          if (sell == newSellProgress) {
            isSolStatusFunc(userId, false);
            isSplTokenStatusFunc(userId, true);
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
          bot.sendMessage(
            userId,
            `
You sold the token.
Reverse swap for ${Number(amountToken)} ${quoteSymbol} -> ${baseSymbol}
<a href="${config.solScanUrl}/${result.txId}">View on Solscan</a>`,
            { parse_mode: "HTML" }
          );
        } else {
          return;
        }
      } else {
        return;
      }
    }
  } catch (error) {
    console.error("Error executing swap:", error);
  }
};
const isSolStatusFunc = (userId: number, flag: boolean) => {
  isSolStatus[userId] = {
    isSol: flag,
  };
};
const isSplTokenStatusFunc = (userId: number, flag: boolean) => {
  isSolStatus[userId] = {
    isSplToken: flag,
  };
};
const processSwap = async (interval: number) => {
  try {
    if (timeAmount > 360) {
      timeAmount = 0;
    }

    timeAmount += interval;
    console.log(timeAmount);
    const swapInfo = await swapInfoController.swapInfo();
    if (swapInfo?.data.length > 0) {
      for (let i = 0; i < swapInfo.data.length; i++) {
        if (
          swapInfo.data[i].active &&
          timeAmount % swapInfo.data[i].loopTime == 0
        ) {
          executeSwap(swapInfo.data[i]);
          delay(3000);
        }
      }
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching swap info:", error);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
};

const inputTokenCheck = async (
  userId: number,
  tokenAddress: any,
  Symbol: string,
  miniAmount: number
) => {
  bot.sendMessage(
    userId,
    `
You have not the ${Symbol} token amount enough.
<b>Required Minimum ${Symbol} Amount: </b> ${miniAmount}
Command Line:  /deposit
`,
    { parse_mode: "HTML" }
  );
};
