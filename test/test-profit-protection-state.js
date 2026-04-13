import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { evaluateProfitProtection } from "../profit-protection-state.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function run() {
  cleanup();
  const trade = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "test", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const armed = evaluateProfitProtection(trade.tradeId, { livePosition: { returnOnEquity: 6 }, analysis: { orderFlowSignals: { directionalBias: "long" } } });
  assert.equal(armed.action, "raise_stop");
  const locked = evaluateProfitProtection(trade.tradeId, { livePosition: { returnOnEquity: 12 }, analysis: { orderFlowSignals: { directionalBias: "long" } } });
  assert.equal(locked.protectionState, "profit_locked");
  cleanup();
  console.log("profit protection state tests passed");
}

run();
