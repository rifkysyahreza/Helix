import assert from "assert";
import { evaluateTradeVeto } from "../analyzers/trade-veto.js";

function run() {
  const vetoed = evaluateTradeVeto({
    analysis: {
      synthesis: { bias: "no_trade", confidence: 0.4 },
      multiTimeframe: { alignment: "mixed" },
      orderBook: { executionQuality: "poor" },
      vwapValue: { location: "inside_value" },
      perpContext: { crowding: "long_crowded" },
    },
    requestedSide: "long",
  });
  assert.equal(vetoed.allowed, false);
  assert(vetoed.vetoes.includes("synthesis_no_trade"));

  const allowed = evaluateTradeVeto({
    analysis: {
      synthesis: { bias: "long", confidence: 0.8 },
      multiTimeframe: { alignment: "aligned" },
      orderBook: { executionQuality: "good" },
      vwapValue: { location: "above_value" },
      perpContext: { crowding: "normal" },
      microstructure: { regime: "tradable", liquidityShift: "stable", absorptionHint: false },
      tradeFlow: { deltaBias: "buy_pressure" },
    },
    requestedSide: "long",
  });
  assert.equal(allowed.allowed, true);

  const cautious = evaluateTradeVeto({
    analysis: {
      synthesis: { bias: "long", confidence: 0.72 },
      multiTimeframe: { alignment: "aligned" },
      orderBook: { executionQuality: "good" },
      vwapValue: { location: "above_value" },
      perpContext: { crowding: "normal" },
      microstructure: { regime: "tradable", liquidityShift: "ask_strengthening", absorptionHint: true },
      tradeFlow: { deltaBias: "sell_pressure" },
      orderFlowSignals: { divergence: "bullish_flow_vs_offer_resistance", absorption: true, liquiditySweep: "upside_sweep_risk", signalBias: "caution" },
    },
    requestedSide: "long",
  });
  assert.equal(cautious.allowed, true);
  assert(cautious.cautions.includes("microstructure_against_long"));
  assert(cautious.cautions.includes("trade_flow_against_long"));
  assert(cautious.cautions.includes("flow_absorption_conflict"));
  assert(cautious.cautions.includes("bullish_flow_vs_offer_resistance"));

  const avoid = evaluateTradeVeto({
    analysis: {
      synthesis: { bias: "long", confidence: 0.8 },
      multiTimeframe: { alignment: "aligned" },
      orderBook: { executionQuality: "good" },
      vwapValue: { location: "above_value" },
      perpContext: { crowding: "normal" },
      microstructure: { regime: "tradable", liquidityShift: "stable", absorptionHint: false },
      tradeFlow: { deltaBias: "buy_pressure" },
      orderFlowSignals: { divergence: "none", absorption: false, liquiditySweep: "none", signalBias: "avoid" },
    },
    requestedSide: "long",
  });
  assert.equal(avoid.allowed, false);
  assert(avoid.vetoes.includes("order_flow_avoid"));

  console.log("trade veto tests passed");
}

run();
