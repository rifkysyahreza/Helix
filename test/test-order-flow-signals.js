import assert from "assert";
import { analyzeOrderFlowSignals } from "../analyzers/order-flow-signals.js";

function run() {
  const caution = analyzeOrderFlowSignals({
    microstructure: { liquidityShift: "ask_strengthening", absorptionHint: true, imbalanceTrend: -0.2, avgSpreadPct: 0.02 },
    tradeFlow: { deltaBias: "buy_pressure" },
    orderBook: { depthBias: "ask_pressure", spreadPct: 0.02 },
    synthesis: { bias: "long" },
  });
  assert.equal(caution.signalBias, "caution");
  assert.equal(caution.absorption, true);
  assert(caution.reasons.includes("absorption_hint"));

  const confirm = analyzeOrderFlowSignals({
    microstructure: { liquidityShift: "stable", absorptionHint: false, imbalanceTrend: 0.15, avgSpreadPct: 0.02 },
    tradeFlow: { deltaBias: "sell_pressure" },
    orderBook: { depthBias: "neutral", spreadPct: 0.02 },
    synthesis: { bias: "short" },
  });
  assert.equal(confirm.signalBias, "short_confirm");

  console.log("order flow signal tests passed");
}

run();
