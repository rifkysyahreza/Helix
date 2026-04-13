import assert from "assert";
import { analyzeVolumeProfile } from "../analyzers/volume-profile.js";
import { analyzePerpContext } from "../analyzers/perp-context.js";
import { analyzeOrderBook } from "../analyzers/order-book.js";

function run() {
  const volumeProfile = analyzeVolumeProfile([
    { h: 101, l: 99, c: 100, v: 10 },
    { h: 102, l: 100, c: 101, v: 30 },
    { h: 103, l: 101, c: 102, v: 50 },
    { h: 104, l: 102, c: 103, v: 20 },
    { h: 105, l: 103, c: 104, v: 5 },
  ]);
  assert.ok(volumeProfile.poc != null);
  assert.ok(Array.isArray(volumeProfile.hvn));
  assert.ok(Array.isArray(volumeProfile.lvn));

  const perpContext = analyzePerpContext({
    snapshot: { funding: 0.0008, openInterest: 1000000, premium: 0.002, dayNtlVlm: 50000000 },
    fundingHistory: [{ fundingRate: 0.0006 }, { fundingRate: 0.0007 }],
  });
  assert.equal(perpContext.crowding, "long_crowded");
  assert(perpContext.signals.includes("positive_funding_crowding"));

  const orderBook = analyzeOrderBook({
    levels: [
      [{ px: 100, sz: 20 }, { px: 99.9, sz: 15 }, { px: 99.8, sz: 10 }],
      [{ px: 100.02, sz: 12 }, { px: 100.03, sz: 10 }, { px: 100.04, sz: 8 }],
    ],
  });
  assert.ok(orderBook.spreadPct != null);
  assert.ok(["bid_support", "ask_pressure", "balanced"].includes(orderBook.depthBias));

  console.log("advanced analyzer tests passed");
}

run();
