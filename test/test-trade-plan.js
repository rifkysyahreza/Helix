import assert from "assert";
import { buildTradePlanFromAnalysis } from "../analyzers/trade-plan.js";

function run() {
  const plan = buildTradePlanFromAnalysis({
    snapshot: { markPx: 105 },
    analysis: {
      structure: { regime: "trend" },
      volatility: { atr: 2.5 },
      vwapValue: { location: "above_value" },
      synthesis: { bias: "long", confidence: 0.75, executionQuality: "good" },
    },
    defaultStopLossPct: 1.5,
    defaultTakeProfitPct: 3,
    side: "long",
  });

  assert.equal(plan.stopLossPct, 1.5);
  assert(plan.target.includes("continuation"));
  assert.ok(Array.isArray(plan.executionNotes));

  console.log("trade plan tests passed");
}

run();
