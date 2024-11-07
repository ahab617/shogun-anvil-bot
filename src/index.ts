import { connectDatabase } from "./db";
import { initBot } from "./bot";
import config from "./config.json";
import { startSwapProcess } from "./swap";

async function start() {
  await connectDatabase(config.database);
  initBot();
  startSwapProcess();
}
start();
