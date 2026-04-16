import assert from "assert";
import fs from "fs";
import { createTradeRecord, getTradeById } from "../state.js";
import { reconcileExecutionLeftovers } from "../reconciliation.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

async function run() {
  cleanup();
  const trade = createTradeRecord({
    symbol: "BTC",
    side: "long",
    sizeUsd: 10,
    thesis: "stale pending test",
    stopLossPct: 1,
    takeProfitPct: 2,
    snapshot: { symbol: "BTC", assetIndex: 0, markPx: 75000, midPx: 75000 },
  });

  await reconcileExecutionLeftovers(20);
  const repaired = getTradeById(trade.tradeId);
  assert.equal(repaired.status, "closed");
  assert.equal(repaired.closeReason, "reconciled_stale_pending");
  console.log("reconciliation stale pending paper tests passed");
}

run();
