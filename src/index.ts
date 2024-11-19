import { initBot } from "./bot";
import config from "./config.json";
import { connectDatabase } from "./db";
import { startSwapProcess } from "./swap";

async function start() {
  try {
    await connectDatabase(config.database);
    await initBot();
    await startSwapProcess();
  } catch (error) {
    console.log("Bot Start Error: ", error);
  }
}
start();
