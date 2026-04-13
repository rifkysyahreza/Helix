import assert from "assert";
import { synthesizeMarketAnalysis } from "../analyzers/market-synthesis.js";

function run() {
  const longCase = synthesizeMarketAnalysis({
    structure: { trendBias: "long", reason: "higher_highs_and_higher_lows" },
    volatility: { expansion: true, compression: false },
    vwapValue: { location: "above_value", lastClose: 105 },
    volumeProfile: { poc: 102 },
    perpContext: { crowding: "normal" },
    orderBook: { depthBias: "bid_support", executionQuality: "good" },
  });
  assert.equal(longCase.bias, "long");
  assert(longCase.confidence >= 0.6);

  const noTradeCase = synthesizeMarketAnalysis({
    structure: { trendBias: "neutral", reason: "balanced_recent_structure" },
    volatility: { expansion: false, compression: true },
    vwapValue: { location: "inside_value", lastClose: 100 },
    volumeProfile: { poc: 100 },
    perpContext: { crowding: "long_crowded" },
    orderBook: { depthBias: "balanced", executionQuality: "poor" },
  });
  assert.ok(["no_trade", "watch_short", "watch_long"].includes(noTradeCase.bias));
  assert(noTradeCase.riskFlags.includes("poor_execution_quality"));

  console.log("market synthesis tests passed");
}

run();
