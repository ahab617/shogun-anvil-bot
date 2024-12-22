import { Connection, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import config from "../config.json";
const connection = new Connection(config.rpcUrl);
// const connection = new Connection(clusterApiUrl("mainnet-beta"), {
//   commitment: "confirmed",
//   wsEndpoint: "wss://api.mainnet-beta.solana.com",
// });
export const rentExemption = async () => {
  try {
    const miniBalance = await connection.getMinimumBalanceForRentExemption(0);
    const rentBalance = Number(miniBalance / LAMPORTS_PER_SOL);
    return rentBalance;
  } catch (error) {
    return null;
  }
};
