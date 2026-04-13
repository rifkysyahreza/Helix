import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { buildManagedWatchlist } from "../stream-watchlist-manager.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function run() {
  cleanup();
  createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const watchlist = buildManagedWatchlist();
  assert.ok(Array.isArray(watchlist));
  assert.ok(watchlist.includes("BTC"));
  cleanup();
  console.log("stream watchlist manager tests passed");
}

run();
