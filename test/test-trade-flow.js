import assert from "assert";
import { analyzeTradeFlow } from "../analyzers/trade-flow.js";

function run() {
  const trades = [
    { side: "buy", sz: 10 },
    { side: "buy", sz: 6 },
    { side: "sell", sz: 3 },
    { side: "buy", sz: 2 },
  ];
  const result = analyzeTradeFlow(trades);
  assert.equal(result.deltaBias, "buy_pressure");
  assert.equal(result.regime, "active");
  console.log("trade flow tests passed");
}

run();
