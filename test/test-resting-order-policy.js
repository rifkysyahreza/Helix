import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { evaluateRestingOrderEscalation } from "../resting-order-policy.js";

const STATE_FILE = "./state.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "ETH", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  updateTradeExecutionState(trade.tradeId, {
    restingOrderActive: true,
    restingOrderPlacedAt: new Date(Date.now() - 3600_000).toISOString(),
    hasOpenOrder: true,
    exchangeTotalFilledSize: 0,
  });
  const stale = evaluateRestingOrderEscalation(trade.tradeId, { staleMs: 1000 });
  assert.equal(stale.escalate, true);
  assert.equal(stale.action, "escalate_entry");

  updateTradeExecutionState(trade.tradeId, {
    restingOrderActive: false,
    hasOpenOrder: false,
    exchangeTotalFilledSize: 0.25,
  });
  const partial = evaluateRestingOrderEscalation(trade.tradeId, { staleMs: 1000 });
  assert.equal(partial.action, "follow_partial_fill");

  cleanup();
  console.log("resting order policy tests passed");
}

run();
