import assert from "assert";
import fs from "fs";
import { createTradeRecord, updateTradeExecutionState } from "../state.js";
import { deriveProtectedStopPrice, applyProfitProtection } from "../stop-protection.js";

const STATE_FILE = "./state.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

async function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: { assetIndex: 0, markPx: 100 } });
  updateTradeExecutionState(trade.tradeId, { restingOrderOid: 123 });
  const stop = deriveProtectedStopPrice({ trade, livePosition: { entryPx: 100, szi: 1 }, protectionState: "break_even_armed" });
  assert.equal(stop > 100, true);
  const applied = await applyProfitProtection({ tradeId: trade.tradeId, livePosition: { entryPx: 100, szi: 1 }, protectionState: "break_even_armed" });
  assert.equal(applied.applied, true);
  cleanup();
  console.log("stop protection tests passed");
}

run();
