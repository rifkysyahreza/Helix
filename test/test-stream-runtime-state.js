import assert from "assert";
import fs from "fs";
import { markStreamSubscription, markStreamFailure, markStreamReconnect, getStreamRuntimeState } from "../stream-runtime-state.js";

const FILE = "./runtime-data/stream-runtime-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  markStreamSubscription("BTC", "orderBook");
  markStreamFailure("BTC", "orderBook", new Error("boom"));
  markStreamReconnect("BTC", "orderBook");
  const state = getStreamRuntimeState();
  assert.equal(state.reconnects, 1);
  assert.equal(state.symbols.BTC.orderBook.active, true);
  assert.equal(state.failures.length, 1);
  cleanup();
  console.log("stream runtime state tests passed");
}

run();
