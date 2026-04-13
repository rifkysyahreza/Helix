import assert from "assert";
import { deriveExecutionTactics } from "../analyzers/execution-tactics.js";

function run() {
  const breakout = deriveExecutionTactics({
    snapshot: { markPx: 100 },
    side: "long",
    analysis: {
      entryStyle: { style: "breakout" },
      orderBook: { spreadPct: 0.02 },
      microstructure: { regime: "tradable" },
      tradeVeto: { cautions: [] },
    },
  });
  assert.equal(breakout.orderStyle, "ioc_limit");
  assert.equal(breakout.urgency, "high");

  const pullback = deriveExecutionTactics({
    snapshot: { markPx: 100 },
    side: "long",
    analysis: {
      entryStyle: { style: "pullback" },
      orderBook: { spreadPct: 0.02 },
      microstructure: { regime: "tradable" },
      tradeVeto: { cautions: [] },
    },
  });
  assert.equal(pullback.orderStyle, "resting_limit_preferred");

  const noTrade = deriveExecutionTactics({
    snapshot: { markPx: 100 },
    side: "long",
    analysis: {
      entryStyle: { style: "no_trade" },
      orderBook: { spreadPct: 0.02 },
      microstructure: { regime: "tradable" },
      tradeVeto: { cautions: [] },
    },
  });
  assert.equal(noTrade.orderStyle, "stand_aside");

  console.log("execution tactics tests passed");
}

run();
