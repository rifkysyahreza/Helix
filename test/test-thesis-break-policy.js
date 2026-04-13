import assert from "assert";
import { evaluateThesisBreak } from "../thesis-break-policy.js";

function run() {
  const broken = evaluateThesisBreak({
    trade: { side: "long" },
    livePosition: { returnOnEquity: -3 },
    analysis: {
      synthesis: { bias: "short" },
      tradeVeto: { blocked: true, reasons: ["structure_break"] },
      multiTimeframe: { alignment: "strong_short" },
      orderFlowSignals: { directionalBias: "short" },
      tradeFlow: { bias: "short" },
      entryStyle: { style: "no_trade" },
    },
  });
  assert.equal(broken.broken, true);
  assert.ok(broken.confidence >= 0.45);

  const intact = evaluateThesisBreak({
    trade: { side: "long" },
    livePosition: { returnOnEquity: 4 },
    analysis: {
      synthesis: { bias: "long" },
      tradeVeto: { blocked: false, reasons: [] },
      multiTimeframe: { alignment: "strong_long" },
      orderFlowSignals: { directionalBias: "long" },
      tradeFlow: { bias: "long" },
      entryStyle: { style: "breakout" },
    },
  });
  assert.equal(intact.broken, false);

  console.log("thesis break policy tests passed");
}

run();
