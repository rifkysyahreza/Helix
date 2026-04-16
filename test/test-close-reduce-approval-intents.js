import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { executeTool } from "../tools/executor.js";

const PENDING_FILE = "./runtime-data/pending-intents.json";

function cleanup() {
  if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
}

async function run() {
  cleanup();
  process.env.HELIX_EXECUTION_MODE = "approval";
  process.env.DRY_RUN = "true";

  const trade = createTradeRecord({
    symbol: "BTC",
    side: "long",
    sizeUsd: 10,
    thesis: "approval close/reduce intent test",
    stopLossPct: 1,
    takeProfitPct: 2,
    snapshot: { symbol: "BTC", assetIndex: 0, markPx: 75000, midPx: 75000 },
  });

  const closeResult = await executeTool("close_position", { tradeId: trade.tradeId, reason: "test" });
  assert.equal(closeResult.requiresApproval, true);
  assert.equal(closeResult.closed, false);
  assert.equal(closeResult.pending?.intent?.type, "close_position");

  const reduceResult = await executeTool("reduce_position", { tradeId: trade.tradeId, reducePct: 50, reason: "test" });
  assert.equal(reduceResult.requiresApproval, true);
  assert.equal(reduceResult.reduced, false);
  assert.equal(reduceResult.pending?.intent?.type, "reduce_position");

  console.log("close reduce approval intent tests passed");
}

run();
