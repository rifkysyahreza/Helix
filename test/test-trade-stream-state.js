import assert from "assert";
import fs from "fs";
import { appendTrades, getTradeStreamState } from "../trade-stream-state.js";

const FILE = "./runtime-data/trade-stream-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  appendTrades("BTC", [{ side: "buy", sz: 1 }]);
  const state = getTradeStreamState("BTC");
  assert.equal(state.trades.length, 1);
  cleanup();
  console.log("trade stream state tests passed");
}

run();
