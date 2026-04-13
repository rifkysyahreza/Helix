import assert from "assert";
import fs from "fs";
import { createTradeRecord } from "../state.js";
import { buildRegimeThrottle } from "../regime-throttle.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function run() {
  cleanup();
  createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "a", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  createTradeRecord({ symbol: "ETH", side: "long", sizeUsd: 100, thesis: "b", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const throttle = buildRegimeThrottle({
    analysesBySymbol: {
      BTC: { synthesis: { bias: "short" } },
      ETH: { synthesis: { bias: "short" } },
    },
  });
  assert.equal(throttle.autonomyLevel, "halt_new_entries");
  assert.ok(throttle.reasons.includes("hostile_regime_alignment"));
  cleanup();
  console.log("regime throttle tests passed");
}

run();
