import assert from "assert";
import { buildSymbolSnapshot } from "../tools/hyperliquid.js";

function run() {
  const snapshot = buildSymbolSnapshot(
    "BTC",
    {
      universe: [{ name: "BTC", maxLeverage: 50, szDecimals: 5, onlyIsolated: false }],
      assetCtxs: [{ markPx: "70000", oraclePx: "70010", funding: "0.0001", openInterest: "1000000", dayNtlVlm: "50000000", premium: "0.001" }],
    },
    { BTC: "70005" },
  );
  assert.equal(snapshot.symbol, "BTC");
  assert.equal(snapshot.markPx, 70000);
  assert.equal(snapshot.midPx, 70005);
  console.log("hyperliquid symbol snapshot tests passed");
}

run();
