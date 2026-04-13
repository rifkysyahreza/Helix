import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { evaluateStreamHealth } from "../stream-health.js";

const STATE_FILE = "./state.json";
const STREAM_FILE = "./runtime-data/market-stream-state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(STREAM_FILE)) fs.unlinkSync(STREAM_FILE);
}

function run() {
  cleanup();
  createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const health = evaluateStreamHealth({ staleMs: 1000 });
  assert.equal(health.healthy, false);
  assert.equal(health.staleSymbols.length >= 1, true);
  cleanup();
  console.log("stream health tests passed");
}

run();
