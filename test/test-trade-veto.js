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
    },
    requestedSide: "long",
  });
  assert.equal(allowed.allowed, true);

  console.log("trade veto tests passed");
}

run();
