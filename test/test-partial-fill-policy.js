import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { evaluatePartialFillFollowUp } from "../partial-fill-policy.js";

const STATE_FILE = "./state.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "SOL", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  updateTradeExecutionState(trade.tradeId, {
    exchangeTotalFilledSize: 60,
    lastRequestedOpenSize: 100,
    remainingOpenSize: 40,
    executionTactics: { orderStyle: "resting_limit_preferred" },
  });
  const result = evaluatePartialFillFollowUp(trade.tradeId);
  assert.equal(result.action, "complete_aggressively");
  cleanup();
  console.log("partial fill policy tests passed");
}

run();
