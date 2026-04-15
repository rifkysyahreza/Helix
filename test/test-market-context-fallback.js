import assert from "assert";
import fs from "fs";
import { updateMarketStreamSnapshot, clearMarketStreamSnapshots } from "../market-stream-state.js";
import { executeTool } from "../tools/executor.js";

const STREAM_FILE = "./runtime-data/market-stream-state.json";

function cleanup() {
  if (fs.existsSync(STREAM_FILE)) fs.unlinkSync(STREAM_FILE);
}

async function run() {
  cleanup();
  updateMarketStreamSnapshot("BTC", { bestBid: 70000, bestAsk: 70010 });
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new TypeError("fetch failed"); };
  const result = await executeTool("get_market_context", { symbols: ["BTC"] });
  global.fetch = originalFetch;
  assert.equal(result.source, "stream_fallback");
  assert.equal(result.symbols[0].symbol, "BTC");
  cleanup();
  console.log("market context fallback tests passed");
}

run();
