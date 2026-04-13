import assert from "assert";
import { analyzeMicrostructureHistory } from "../analyzers/microstructure.js";

function run() {
  const samples = [
    { imbalance: 0.1, spreadPct: 0.02, bidDepth: 100, askDepth: 90 },
    { imbalance: 0.15, spreadPct: 0.021, bidDepth: 110, askDepth: 85 },
    { imbalance: 0.2, spreadPct: 0.019, bidDepth: 120, askDepth: 80 },
    { imbalance: 0.22, spreadPct: 0.02, bidDepth: 125, askDepth: 78 },
  ];
  const result = analyzeMicrostructureHistory(samples);
  assert.equal(result.liquidityShift, "bid_strengthening");
  assert.equal(result.absorptionHint, true);
  console.log("microstructure tests passed");
}

run();
