import { initBot } from "./bot";
import config from "./config.json";
import { connectDatabase } from "./db";
import { startSolTracker } from "./service/startSolTracker";
import { FeeTransferQueueUpdator } from "./service/feeSend";
import { startSwapProcess } from "./swap";

async function start() {
  try {
    await connectDatabase(config.database);
    await initBot();
    await startSolTracker();
    await FeeTransferQueueUpdator();
    await startSwapProcess();
  } catch (error) {
    console.log("Bot Start Error: ", error);
  }
}
start();
