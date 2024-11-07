import axios from "axios";
import config from "../config.json";
const getTokenPrice = async (
  sourceToken: string,
  targetToken: string
): Promise<number | null> => {
  try {
    const apiUrl = `${config.dexAPI}/${targetToken}`;

    const response = await axios.get(apiUrl);

    if (response.status !== 200) {
      return null;
    }

    const tokens = response.data.pairs;
    // Find the trading pair for the source and target tokens
    const pair = tokens.find(
      (pair: any) =>
        (pair.baseToken.address === sourceToken &&
          pair.quoteToken.address === targetToken) ||
        (pair.baseToken.address === targetToken &&
          pair.quoteToken.address === sourceToken)
    );

    if (!pair) {
      return null;
    }
    // Calculate the price based on the pair's data
    if (pair.baseToken.address === targetToken) {
      // Price of source token in target token
      return parseFloat(pair.priceNative); // Price in target token
    } else {
      // Price of target token in source token
      return 1 / parseFloat(pair.priceNative); // Inverse of price
    }
  } catch (error) {
    return null;
  }
};

export const convertTokenAmount = async (
  sourceAmount: number,
  sourceToken: string,
  targetToken: string
): Promise<number | null> => {
  const price = await getTokenPrice(sourceToken, targetToken);
  if (price === null) {
    return null;
  }
  const targetAmount = sourceAmount / price;
  return Number(targetAmount);
};
