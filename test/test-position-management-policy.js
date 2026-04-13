import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { evaluatePositionManagement } from "../position-management-policy.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function run() {
  cleanup();
  const close = evaluatePositionManagement({
    trade: { tradeId: "t1", symbol: "BTC", side: "long", sizeUsd: 100, executionState: { executionTactics: { orderStyle: "ioc_limit" } }, reductions: [] },
    livePosition: { returnOnEquity: -9, unrealizedPnl: -5 },
    analysis: {
      synthesis: { bias: "short" },
      tradeVeto: { blocked: true, reasons: ["structure_break"] },
      multiTimeframe: { alignment: "strong_short" },
      orderFlowSignals: { directionalBias: "short" },
      tradeFlow: { bias: "short" },
      entryStyle: { style: "no_trade" },
    },
  });
  assert.equal(close.action, "close");

  const reduce = evaluatePositionManagement({
    trade: { tradeId: "t2", symbol: "ETH", side: "long", sizeUsd: 100, executionState: { executionTactics: { orderStyle: "ioc_limit" } }, reductions: [] },
    livePosition: { returnOnEquity: 15, unrealizedPnl: 14 },
    analysis: {
      synthesis: { bias: "long" },
      tradeVeto: { blocked: false, reasons: [] },
      multiTimeframe: { alignment: "strong_long" },
      orderFlowSignals: { directionalBias: "long" },
      tradeFlow: { bias: "long" },
      entryStyle: { style: "breakout" },
    },
  });
  assert.equal(reduce.action, "reduce");
  assert.equal(reduce.reducePct, 50);

  const protectTrade = createTradeRecord({ symbol: "SOL", side: "long", sizeUsd: 100, thesis: "protect", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const trailing = evaluatePositionManagement({
    trade: { ...protectTrade, executionState: { executionTactics: { orderStyle: "ioc_limit" } }, reductions: [] },
    livePosition: { returnOnEquity: 12, unrealizedPnl: 10 },
    analysis: {
      synthesis: { bias: "long" },
      tradeVeto: { blocked: false, reasons: [] },
      multiTimeframe: { alignment: "strong_long" },
      orderFlowSignals: { directionalBias: "long" },
      tradeFlow: { bias: "long" },
      entryStyle: { style: "breakout" },
      vwapValue: { valueLocation: "above_value" },
    },
  });
  assert.equal(trailing.action, "protect");

  cleanup();
  console.log("position management policy tests passed");
}

run();
