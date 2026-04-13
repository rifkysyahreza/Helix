import assert from "assert";
import { evaluatePositionManagement } from "../position-management-policy.js";

function run() {
  const close = evaluatePositionManagement({
    trade: { tradeId: "t1", symbol: "BTC", sizeUsd: 100, executionState: { executionTactics: { orderStyle: "ioc_limit" } }, reductions: [] },
    livePosition: { returnOnEquity: -9, unrealizedPnl: -5 },
  });
  assert.equal(close.action, "close");

  const reduce = evaluatePositionManagement({
    trade: { tradeId: "t2", symbol: "ETH", sizeUsd: 100, executionState: { executionTactics: { orderStyle: "ioc_limit" } }, reductions: [] },
    livePosition: { returnOnEquity: 15, unrealizedPnl: 14 },
  });
  assert.equal(reduce.action, "reduce");
  assert.equal(reduce.reducePct, 50);

  console.log("position management policy tests passed");
}

run();
