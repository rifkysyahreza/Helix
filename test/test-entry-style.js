import assert from "assert";
import { analyzeEntryStyle } from "../analyzers/entry-style.js";

function run() {
  const breakout = analyzeEntryStyle({
    requestedSide: "long",
    analysis: {
      synthesis: { bias: "long" },
      vwapValue: { location: "above_value" },
      structure: { regime: "compression" },
      multiTimeframe: { alignment: "aligned" },
      tradeFlow: { deltaBias: "buy_pressure" },
      microstructure: { regime: "tradable" },
      orderFlowSignals: { signalBias: "long_confirm", absorption: false },
      tradeVeto: { allowed: true, cautions: [] },
    },
  });
  assert.equal(breakout.style, "breakout");

  const fade = analyzeEntryStyle({
    requestedSide: "short",
    analysis: {
      synthesis: { bias: "short" },
      vwapValue: { location: "above_value" },
      structure: { regime: "trend" },
      multiTimeframe: { alignment: "mixed" },
      tradeFlow: { deltaBias: "buy_pressure" },
      microstructure: { regime: "tradable" },
      orderFlowSignals: { signalBias: "caution", absorption: true, divergence: "bullish_flow_vs_offer_resistance" },
      tradeVeto: { allowed: true, cautions: ["flow_absorption_conflict"] },
    },
  });
  assert.equal(fade.style, "fade");

  const noTrade = analyzeEntryStyle({
    requestedSide: "long",
    analysis: {
      synthesis: { bias: "no_trade" },
      tradeVeto: { allowed: false, reason: "synthesis_no_trade" },
    },
  });
  assert.equal(noTrade.style, "no_trade");

  console.log("entry style tests passed");
}

run();
