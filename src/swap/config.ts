import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { TxVersion, parseTokenAccountResp } from "@raydium-io/raydium-sdk-v2";
import config from "../config.json";

const connection = new Connection(config.rpcUrl);
// const connection = new Connection(clusterApiUrl("mainnet-beta"), {
//   commitment: "confirmed",
//   wsEndpoint: "wss://api.mainnet-beta.solana.com",
// });
export const txVersion = TxVersion.V0; // or TxVersion.LEGACY

export const fetchTokenAccountData = async (owner: Keypair) => {
  try {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey);
    const tokenAccountResp = await connection.getTokenAccountsByOwner(
      owner.publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );
    const token2022Req = await connection.getTokenAccountsByOwner(
      owner.publicKey,
      { programId: TOKEN_2022_PROGRAM_ID }
    );
    const tokenAccountData = await parseTokenAccountResp({
      owner: owner.publicKey,
      solAccountResp,
      tokenAccountResp: {
        context: tokenAccountResp.context,
        value: [...tokenAccountResp.value, ...token2022Req.value],
      },
    });
    return tokenAccountData;
  } catch (error) {
    console.log("fetchTokenAccountDataError: ", error);
  }
};
