import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { replaceRestingOrder } from "../order-modify.js";

const STATE_FILE = "./state.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

async function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: { assetIndex: 0, markPx: 100 } });
  updateTradeExecutionState(trade.tradeId, {
    restingOrderOid: 123,
    remainingOpenSize: 40,
  });
  const result = await replaceRestingOrder({ tradeId: trade.tradeId, price: 99.5 });
  assert.equal(result.replaced, false);
  assert.equal(result.requiresLiveMode, true);
  cleanup();
  console.log("order modify tests passed");
}

run();
