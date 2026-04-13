import assert from "assert";
import { summarizeSymbolAnalysis } from "../analyzers/analysis-summary.js";

function run() {
  const summary = summarizeSymbolAnalysis({
    structure: { regime: "trend", trendBias: "long", reason: "higher_highs" },
    volatility: { regime: "expansion", reason: "atr_expanding" },
    vwapValue: { location: "above_value", vwap: 101.2, poc: 100.8 },
    perpContext: { crowding: "normal", funding: 0.0001, premium: 0.001 },
    orderBook: { depthBias: "bid_support", spreadPct: 0.02, executionQuality: "good" },
    synthesis: { bias: "long", confidence: 0.7, riskFlags: ["test_flag"], reasons: ["bid_support"] },
  });

  assert(summary.includes("Bias: long"));
  assert(summary.includes("Structure: trend / long"));
  assert(summary.includes("Risk flags: test_flag"));

  console.log("analysis summary tests passed");
}

run();
