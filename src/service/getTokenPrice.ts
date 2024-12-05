import axios from "axios";
import config from "../config.json";

const getTokenPrice = async (
  sourceToken: string,
  targetToken: string
): Promise<number | null> => {
  try {
    console.log("targetToken: ", targetToken);
    const apiUrl = `${config.dexAPI}/${targetToken}`;
    console.log("apiUrl: ", apiUrl);
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
    console.log(error, "1234567890");
    return null;
  }
};

export const convertTokenAmount = async (
  sourceAmount: number,
  sourceToken: string,
  targetToken: string
): Promise<number | null> => {
  try {
    const price = await getTokenPrice(sourceToken, targetToken);
    if (price === null) {
      return null;
    }
    const targetAmount = sourceAmount / price;
    return Number(targetAmount);
  } catch (error) {
    console.log(error, "123456789012378996");
    return null;
  }
};
