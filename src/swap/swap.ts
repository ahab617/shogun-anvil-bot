import {
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  Keypair,
  Connection,
} from "@solana/web3.js";
import axios from "axios";
import Decimal from "decimal.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { decryptPrivateKey, delay } from "../service/index";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import { fetchTokenAccountData } from "./config";
import config from "../config.json";

const connection = new Connection(config.rpcUrl);
export let walletPublic = "" as string;

interface SwapCompute {
  id: string;
  success: true;
  version: "V0" | "V1";
  openTime?: undefined;
  msg: undefined;
  data: {
    swapType: "BaseIn" | "BaseOut";
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routePlan: {
      poolId: string;
      inputMint: string;
      outputMint: string;
      feeMint: string;
      feeRate: number;
      feeAmount: string;
    }[];
  };
}

export const apiSwap = async (
  inputAmount: number,
  baseDecimal: number,
  inputMintAddress: string,
  outMintAddress: string,
  walletPrivateKey: string,
  priorityFee: string
) => {
  try {
    const privateKey = (await decryptPrivateKey(walletPrivateKey)) as string;

    const owner: Keypair = Keypair.fromSecretKey(
      Buffer.from(privateKey, "base64")
    );
    const inputMint = inputMintAddress;
    const outputMint = outMintAddress; // RAY
    const amount = new Decimal(inputAmount)
      .mul(Math.pow(10, baseDecimal))
      .toFixed(0);
    const slippage = 1; // in percent, for this example, 0.5 means 0.5%
    const txVersion: string = "V0"; // or LEGACY
    const isV0Tx = txVersion === "V0";

    const [isInputSol, isOutputSol] = [
      inputMint === NATIVE_MINT.toBase58(),
      outputMint === NATIVE_MINT.toBase58(),
    ];
    const { tokenAccounts } = (await fetchTokenAccountData(owner)) as any;
    const inputTokenAcc = tokenAccounts.find(
      (a: any) => a.mint.toBase58() === inputMint
    )?.publicKey;
    const outputTokenAcc = tokenAccounts.find(
      (a: any) => a.mint.toBase58() === outputMint
    )?.publicKey;

    if (!inputTokenAcc && !isInputSol) {
      return {
        status: 401,
        msg: "Do not have input token account",
        token: inputMintAddress,
        inputAmount: inputAmount,
      };
    }
    const { data } = await axios.get<{
      id: string;
      success: boolean;
      data: { default: { vh: number; h: number; m: number } };
    }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
    const { data: swapResponse } = await axios.get<SwapCompute>(
      `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}&txVersion=${txVersion}`
    );
    // Check if the swap response was successful
    if (!swapResponse.success) {
      return { status: 403, msg: `Swap failed: ${swapResponse.msg}` };
    }
    let priorityFeeValue = 0;
    if (priorityFee === "high") {
      priorityFeeValue = data.data.default.vh;
    } else if (priorityFee === "medium") {
      priorityFeeValue = data.data.default.h;
    } else {
      priorityFeeValue = data.data.default.m;
    }
    const { data: swapTransactions } = await axios.post<{
      id: string;
      version: string;
      success: boolean;
      data: { transaction: string }[];
    }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
      computeUnitPriceMicroLamports: String(priorityFeeValue),
      swapResponse,
      txVersion,
      wallet: owner.publicKey.toBase58(),
      wrapSol: isInputSol,
      unwrapSol: isOutputSol,
      inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
      outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
    });
    // Check if swapTransactions is valid
    if (!swapTransactions.success || !swapTransactions.data) {
      return { status: 403, msg: `Swap transactions failed` };
    }
    const allTxBuf = swapTransactions.data.map((tx) =>
      Buffer.from(tx.transaction, "base64")
    );
    const allTransactions = allTxBuf.map((txBuf) =>
      isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
    );
    let idx = 0;
    if (!isV0Tx) {
      for (const tx of allTransactions) {
        const transaction = tx as Transaction;
        transaction.sign(owner);
        try {
          const txId = await sendAndConfirmTransaction(
            connection,
            transaction,
            [owner],
            { skipPreflight: true }
          );
          return { status: 200, txId: txId };
        } catch (error) {
          return { status: 403, msg: `Error sending transaction: ${error}` };
        }
      }
    } else {
      for (const tx of allTransactions) {
        idx++;
        const transaction = tx as VersionedTransaction;
        transaction.sign([owner]);
        try {
          const txId = await connection.sendTransaction(transaction, {
            skipPreflight: true,
          });
          const { lastValidBlockHeight, blockhash } =
            await connection.getLatestBlockhash({ commitment: "finalized" });
          const r = await connection.confirmTransaction(
            { blockhash, lastValidBlockHeight, signature: txId },
            "confirmed"
          );
          if (r) {
            return { status: 200, txId: txId };
          } else {
            return { status: 403, msg: `Error sending transaction` };
          }
        } catch (error) {
          return { status: 403, msg: `Error sending transaction: ${error}` };
        }
      }
    }
  } catch (error) {
    return { status: 403, msg: `Error in apiSwap: ${error}` };
  }
};
