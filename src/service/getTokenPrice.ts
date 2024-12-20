import axios from "axios";
import config from "../config.json";
import { subBalance } from "../bot/library";

const getTokenPrice = async (
  sourceToken: string,
  targetToken: string
): Promise<number | null> => {
  try {
    const apiUrl = `${config.dexAPI}/${targetToken}`;
    const response = await axios.post(apiUrl, {}, { timeout: 5000 });

    if (response.status !== 200) {
      console.log("Error fetching token price");
      return null;
    }

    const tokens = response.data.pairs;
    const pair = tokens.find(
      (pair: any) =>
        (pair.baseToken.address === sourceToken &&
          pair.quoteToken.address === targetToken) ||
        (pair.baseToken.address === targetToken &&
          pair.quoteToken.address === sourceToken)
    );

    if (!pair) {
      console.log("No pair found");
      return null;
    }
    if (pair.baseToken.address === targetToken) {
      return parseFloat(pair.priceNative);
    } else {
      return 1 / parseFloat(pair.priceNative);
    }
  } catch (error) {
    return null;
  }
};

export const convertTokenAmount = async (
  sourceAmount: number,
  sourceToken: string,
  targetToken: string
) => {
  try {
    const price = await getTokenPrice(sourceToken, targetToken);
    if (price === null) {
      await retryConvertTokenAmount(sourceAmount, sourceToken, targetToken);
    } else {
      const targetAmount = sourceAmount / price;
      const splTokenAmount = await subBalance(targetAmount);
      return Number(splTokenAmount);
    }
  } catch (error) {
    return null;
  }
};

const retryConvertTokenAmount = async (
  sourceAmount: number,
  sourceToken: string,
  targetToken: string
) => {
  try {
    const price = await getTokenPrice(sourceToken, targetToken);
    if (price === null) {
      return null;
    } else {
      const targetAmount = sourceAmount / price;
      const splTokenAmount = await subBalance(targetAmount);
      return Number(splTokenAmount);
    }
  } catch (error) {
    return null;
  }
};
