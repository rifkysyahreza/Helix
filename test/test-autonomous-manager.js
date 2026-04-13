import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { runAutonomousManagementPass } from "../autonomous-manager.js";

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
    restingOrderActive: true,
    restingOrderPlacedAt: new Date(Date.now() - 3600_000).toISOString(),
    hasOpenOrder: true,
    exchangeTotalFilledSize: 0,
    restingOrderOid: 123,
  });

  const result = await runAutonomousManagementPass({ autoAct: false });
  assert.ok(Array.isArray(result.actions));
  assert.equal(result.actions.length >= 1, true);
  assert.ok(Array.isArray(result.positionDecisions));

  updateTradeExecutionState(trade.tradeId, {
    restingOrderActive: false,
    hasOpenOrder: false,
    exchangeTotalFilledSize: 60,
    lastRequestedOpenSize: 100,
    remainingOpenSize: 40,
    executionTactics: { orderStyle: "resting_limit_preferred" },
  });
  const partial = await runAutonomousManagementPass({ autoAct: false });
  assert.equal(Array.isArray(partial.actions), true);
  cleanup();
  console.log("autonomous manager tests passed");
}

run();
