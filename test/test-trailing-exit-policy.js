import assert from "assert";
import { evaluateTrailingExit } from "../trailing-exit-policy.js";

function run() {
  const trim = evaluateTrailingExit({
    trade: { side: "long" },
    livePosition: { returnOnEquity: 12 },
    analysis: {
      synthesis: { bias: "long" },
      vwapValue: { valueLocation: "below_value" },
      orderFlowSignals: { directionalBias: "short" },
      tradeFlow: { bias: "short" },
    },
  });
  assert.equal(trim.action, "reduce");

  const hold = evaluateTrailingExit({
    trade: { side: "long" },
    livePosition: { returnOnEquity: 5 },
    analysis: {
      synthesis: { bias: "long" },
      vwapValue: { valueLocation: "above_value" },
      orderFlowSignals: { directionalBias: "long" },
      tradeFlow: { bias: "long" },
    },
  });
  assert.equal(hold.action, "hold");

  console.log("trailing exit policy tests passed");
}

run();
