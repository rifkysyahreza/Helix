import assert from "assert";
import { buildTradePlanFromAnalysis } from "../analyzers/trade-plan.js";

function run() {
  const breakoutPlan = buildTradePlanFromAnalysis({
    snapshot: { markPx: 105 },
    analysis: {
      structure: { regime: "trend" },
      volatility: { atr: 2.5 },
      vwapValue: { location: "above_value" },
      synthesis: { bias: "long", confidence: 0.75, executionQuality: "good" },
      tradeFlow: { deltaBias: "buy_pressure" },
      microstructure: { regime: "tradable" },
      orderFlowSignals: { divergence: "none", absorption: false, liquiditySweep: "none" },
      tradeVeto: { cautions: [] },
      entryStyle: { style: "breakout", aggression: "high" },
    },
    defaultStopLossPct: 1.5,
    defaultTakeProfitPct: 3,
    side: "long",
  });

  assert.equal(breakoutPlan.stopLossPct, 1.5);
  assert.equal(breakoutPlan.takeProfitPct, 3.79);
  assert(breakoutPlan.target.includes("continuation"));
  assert.ok(Array.isArray(breakoutPlan.executionNotes));
  assert(breakoutPlan.executionNotes[0].includes("Preferred entry style: breakout"));

  const fadePlan = buildTradePlanFromAnalysis({
    snapshot: { markPx: 105 },
    analysis: {
      structure: { regime: "trend" },
      volatility: { atr: 2.5 },
      vwapValue: { location: "above_value" },
      synthesis: { bias: "short", confidence: 0.75, executionQuality: "good" },
      tradeFlow: { deltaBias: "sell_pressure" },
      microstructure: { regime: "tradable" },
      orderFlowSignals: { divergence: "bullish_flow_vs_offer_resistance", absorption: true, liquiditySweep: "none" },
      tradeVeto: { cautions: ["flow_absorption_conflict"] },
      entryStyle: { style: "fade", aggression: "low" },
    },
    defaultStopLossPct: 1.5,
    defaultTakeProfitPct: 3,
    side: "short",
  });

  assert.equal(fadePlan.stopLossPct, 1.35);
  assert.equal(fadePlan.takeProfitPct, 2.93);

  console.log("trade plan tests passed");
}

run();
