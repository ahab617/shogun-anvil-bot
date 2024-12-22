import {
  Connection,
  PublicKey,
  Keypair,
  clusterApiUrl,
  ParsedAccountData,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import crypto from "crypto";
import * as Web3 from "@solana/web3.js";
import { bot } from "../bot";
import config from "../config.json";
import withdrawController from "../controller/withdraw";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = config.salt;
const IV_LENGTH = 12;

const connection = new Connection(config.rpcUrl);
// const connection = new Connection(clusterApiUrl("mainnet-beta"), {
//   commitment: "confirmed",
//   wsEndpoint: "wss://api.mainnet-beta.solana.com",
// });

export let isDepositStatus = {} as any;

export const withdrawService = async (withInfo: any) => {
  try {
    const privatekey = (await decryptPrivateKey(withInfo.privateKey)) as string;
    if (withInfo.token === config.solTokenAddress) {
      const result = await sendSol(
        withInfo.amount,
        withInfo.withdrawAddress,
        privatekey
      );
      return result;
    } else {
      const result = await transferSplToken(
        privatekey,
        withInfo.token,
        withInfo.withdrawAddress,
        withInfo.amount
      );
      return result;
    }
  } catch (error) {
    console.log("withdrawServiceError: ", error);
  }
};
export const sendSol = async (
  amount: number,
  toAddress: string,
  privatekey: string
) => {
  try {
    const sender = (await getKeyPairFromPrivatekey(privatekey)) as any;
    const to = new PublicKey(toAddress);
    const balance = await connection.getBalance(sender.publicKey);
    // Define constants
    const rentExemptMin = 0.00203928 * LAMPORTS_PER_SOL; // Rent-exempt minimum in lamports
    const transactionFee = 5000; // Approximate transaction fee in lamports

    // Calculate maximum withdrawable amount
    const maxWithdrawableLamports = balance - rentExemptMin - transactionFee;

    if (maxWithdrawableLamports <= 0) {
      console.log(
        "Insufficient balance to cover transaction fees or rent-exempt minimum."
      );
      return {
        result: null,
        msg: "Insufficient balance to cover transaction fees or rent-exempt minimum.",
      };
    }
    // Compare requested amount with maximum withdrawable amount
    const lamportsToWithdraw = Math.min(
      amount * LAMPORTS_PER_SOL,
      maxWithdrawableLamports
    );
    if (lamportsToWithdraw < 0) {
      return {
        result: null,
        msg: `Please enter the valid amount to withdraw`,
      };
    }
    const { lastValidBlockHeight, blockhash } =
      await connection.getLatestBlockhash({
        commitment: "finalized",
      });
    let newNonceTx = new Transaction();

    newNonceTx.feePayer = sender.publicKey;
    newNonceTx.recentBlockhash = blockhash;
    newNonceTx.lastValidBlockHeight = lastValidBlockHeight;
    newNonceTx.add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: to,
        lamports: lamportsToWithdraw,
      })
    );

    const tx = await sendAndConfirmTransaction(connection, newNonceTx, [
      sender,
    ]);
    return { result: tx, msg: `` };
  } catch (err: any) {
    return {
      result: null,
      msg: `Please try again later due to network overload`,
    };
  }
};

export const estimateSOLTransferFee = async (
  sender: string,
  recipient: string,
  amount: number
) => {
  try {
    const from = new PublicKey(sender);
    const to = new PublicKey(recipient);
    let newNonceTx = new Web3.Transaction();
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    newNonceTx.feePayer = from;
    newNonceTx.recentBlockhash = blockhash;
    newNonceTx.lastValidBlockHeight = lastValidBlockHeight;
    const decimals = LAMPORTS_PER_SOL; // 1 SOL = 1e9 lamports
    const transferAmountInDecimals = Number(
      Math.floor(amount * decimals)
        .toString()
        .split(".")[0]
    );

    newNonceTx.add(
      Web3.SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: transferAmountInDecimals,
      })
    );
    const fee = await connection.getFeeForMessage(newNonceTx.compileMessage());
    return fee?.value || 0;
  } catch (error) {
    console.log("estimateSOLTransferFee: ", error);
  }
};

export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
const transferSplToken = async (
  privatekey: string,
  tokenAddr: string,
  dis: string,
  amount: number
) => {
  try {
    console.log(privatekey, tokenAddr, dis, amount);
    const fromWallet = (await getKeyPairFromPrivatekey(privatekey)) as any;
    const destPublicKey = new PublicKey(dis);
    const mintPublicKey = new PublicKey(tokenAddr);
    const decimals = (await getNumberDecimals(mintPublicKey, connection)) || 0;

    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      mintPublicKey,
      fromWallet.publicKey
    );
    console.log("senderTokenAccount:", senderTokenAccount);
    const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      fromWallet,
      mintPublicKey,
      destPublicKey
    );
    console.log("receiverTokenAccount: ", receiverTokenAccount);
    const tx = await transfer(
      connection,
      fromWallet,
      senderTokenAccount.address,
      receiverTokenAccount.address,
      fromWallet.publicKey,
      amount * 10 ** decimals
    );
    return { result: tx, msg: `` };
  } catch (error) {
    console.log("transferSplTokenError: ", error);
    return { result: null, msg: `` };
  }
};

export const getKeyPairFromPrivatekey = async (PRIVATE_KEY: any) => {
  try {
    const keypair = Keypair.fromSecretKey(Buffer.from(PRIVATE_KEY, "base64"));
    return keypair;
  } catch (error) {
    console.log("getKeyPairFromPrivatekeyError: ", error);
  }
};

async function getNumberDecimals(
  mintAddress: PublicKey,
  connection: Connection
) {
  try {
    const info = await connection.getParsedAccountInfo(mintAddress);
    const decimals = (info.value?.data as ParsedAccountData).parsed.info
      .decimals as number;
    return decimals;
  } catch (error) {
    console.log("getNumberDecimalsError: ", error);
  }
}

/**
 * Encrypts a private key before storing it in the database.
 * @param privateKey The private key to encrypt.
 * @returns The encrypted private key.
 */
export const encryptPrivateKey = (privateKey: string) => {
  try {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
      throw new Error("Invalid encryption key length. Must be 32 characters.");
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(privateKey, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  } catch (error) {
    console.log("encryptPrivateKeyError: ", error);
  }
};

/**
 * Decrypts an encrypted private key stored in the database.
 * @param encryptedPrivateKey The encrypted private key to decrypt.
 * @returns The decrypted private key.
 */
export const decryptPrivateKey = (encryptedPrivateKey: string) => {
  try {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
      throw new Error("Invalid encryption key length. Must be 32 characters.");
    }
    const encryptedBuffer = Buffer.from(encryptedPrivateKey, "base64");
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const tag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + 16);
    const encryptedText = encryptedBuffer.slice(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.log("decryptPrivateKeyError: ", error);
  }
};

export const getWalletTokenBalances = async (walletAddress: string) => {
  try {
    // Convert the wallet address into a PublicKey
    const walletPublicKey = new PublicKey(walletAddress);

    // Fetch all token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      } // Token program ID
    );

    // Extract balances from each token account
    const balances = tokenAccounts.value.map((tokenAccount) => {
      const accountData = tokenAccount.account.data.parsed.info;
      const address = accountData.mint as string; // Token mint address
      const decimals = accountData.tokenAmount.decimals as number; // Token decimals
      const amount = accountData.tokenAmount.uiAmount as number; // Human-readable token balance

      return {
        address,
        decimals,
        amount,
      };
    });
    return balances;
  } catch (error) {
    console.error("Error fetching token balances:", error);
  }
};
