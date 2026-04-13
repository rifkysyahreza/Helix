import assert from "assert";
import fs from "fs";
import { createTradeRecord, getTradeById } from "../state.js";
import { markRestingOrderPlaced, scanStaleRestingOrders } from "../resting-orders.js";

const STATE_FILE = "./state.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  markRestingOrderPlaced(trade.tradeId, { orderStyle: "resting_limit_preferred", tif: "Gtc", oid: 123, placedAt: new Date(Date.now() - 3600_000).toISOString() });
  const scan = scanStaleRestingOrders(50, 1000);
  assert.equal(scan.stale.length, 1);
  const updated = getTradeById(trade.tradeId);
  assert.equal(updated.executionState.restingOrderStale, true);
  cleanup();
  console.log("resting orders tests passed");
}

run();
