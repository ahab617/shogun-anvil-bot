import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import config from "../config.json";
import { subBalance } from "../bot/library";
const splToken = require("@solana/spl-token");
const connection = new Connection(config.rpcUrl);

export const checkSolBalance = async (addr: string) => {
  try {
    const publickey = new PublicKey(addr);
    const balance = (await connection.getBalance(publickey)) / 1e9;
    if (balance || balance === 0) {
      const solBalance = await subBalance(balance);
      return solBalance;
    } else {
      await retryCheckSolBalance(addr);
    }
  } catch (error) {
    console.log("checkSolBalanceError: ", error);
    return null;
  }
};
const retryCheckSolBalance = async (addr: string) => {
  try {
    const publickey = new PublicKey(addr);
    const balance = (await connection.getBalance(publickey)) / 1e9;
    if (balance || balance === 0) {
      const solBalance = await subBalance(balance);
      return solBalance;
    } else {
      return null;
    }
  } catch (error) {
    console.log("checkSolBalanceError: ", error);
    return null;
  }
};

const getSPLTokenAccount = async (
  tokenMintAddress: string,
  walletPublicKey: string
) => {
  try {
    const associatedTokenAddress = await splToken.getAssociatedTokenAddress(
      new PublicKey(tokenMintAddress),
      new PublicKey(walletPublicKey)
    );
    return associatedTokenAddress;
  } catch (error) {
    console.log("getSPLTokenAccountError: ", error);
    return null;
  }
};
export const checkSplTokenBalance = async (
  tokenMintAddress: string,
  walletPublicKey: string
) => {
  try {
    const tokenAccount = await getSPLTokenAccount(
      tokenMintAddress,
      walletPublicKey
    );

    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    if (tokenBalance?.value.uiAmount) {
      const splTokenBalance = await subBalance(tokenBalance?.value.uiAmount);
      return Number(splTokenBalance);
    } else {
      await retrycheckSplTokenBalance(tokenMintAddress, walletPublicKey);
    }
  } catch (error) {
    console.log("checkSplTokenBalanceError: ", error);
    return null;
  }
};

const retrycheckSplTokenBalance = async (
  tokenMintAddress: string,
  walletPublicKey: string
) => {
  try {
    const tokenAccount = await getSPLTokenAccount(
      tokenMintAddress,
      walletPublicKey
    );

    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);

    if (tokenBalance?.value.uiAmount || tokenBalance?.value.uiAmount == 0) {
      const splTokenBalance = await subBalance(tokenBalance?.value.uiAmount);
      return Number(splTokenBalance);
    } else {
      return null;
    }
  } catch (error) {
    console.log("checkSplTokenBalanceError: ", error);
    return null;
  }
};
