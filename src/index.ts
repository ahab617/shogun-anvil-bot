import { initBot } from "./bot";
import config from "./config.json";
import { connectDatabase } from "./db";
import { startSolTracker } from "./service/startSolTracker";
import { startSwapProcess } from "./swap";

async function start() {
  try {
    await connectDatabase(config.database);
    await initBot();
    await startSwapProcess();
    await startSolTracker();
  } catch (error) {
    console.log("Bot Start Error: ", error);
  }
}
start();
