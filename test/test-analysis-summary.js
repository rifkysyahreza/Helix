import assert from "assert";
import { summarizeSymbolAnalysis } from "../analyzers/analysis-summary.js";

function run() {
  const summary = summarizeSymbolAnalysis({
    structure: { regime: "trend", trendBias: "long", reason: "higher_highs" },
    volatility: { regime: "expansion", reason: "atr_expanding" },
    vwapValue: { location: "above_value", vwap: 101.2, poc: 100.8 },
    perpContext: { crowding: "normal", funding: 0.0001, premium: 0.001 },
    orderBook: { depthBias: "bid_support", spreadPct: 0.02, executionQuality: "good" },
    microstructure: { regime: "tradable", liquidityShift: "stable", absorptionHint: false },
    tradeFlow: { deltaBias: "buy_pressure", delta: 12, aggressionBias: "aggressive" },
    orderFlowSignals: { signalBias: "long_confirm", divergence: "none", liquiditySweep: "none", absorption: false },
    synthesis: { bias: "long", confidence: 0.7, riskFlags: ["test_flag"], reasons: ["bid_support"] },
  });

  assert(summary.includes("Bias: long"));
  assert(summary.includes("Structure: trend / long"));
  assert(summary.includes("Risk flags: test_flag"));
  assert(summary.includes("Order flow signals: long_confirm"));

  console.log("analysis summary tests passed");
}

run();
