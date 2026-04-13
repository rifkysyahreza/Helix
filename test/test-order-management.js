import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { cancelRestingOrder } from "../order-management.js";

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
    restingOrderActive: true,
  });

  const result = await cancelRestingOrder({ tradeId: trade.tradeId });
  assert.equal(result.cancelled, false);
  assert.equal(result.requiresLiveMode, true);

  cleanup();
  console.log("order management tests passed");
}

run();
