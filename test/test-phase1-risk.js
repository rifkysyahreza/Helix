import assert from "assert";
import { validateNewPositionRisk, validateCloseRisk } from "../risk.js";

function run() {
  const account = {
    withdrawable: 100,
    positions: [{ coin: "BTC", szi: 0.01 }],
  };

  const existingTrades = [
    { symbol: "BTC", status: "open", sizeUsd: 50 },
    { symbol: "ETH", status: "open", sizeUsd: 70 },
  ];

  const duplicate = validateNewPositionRisk({
    symbol: "btc",
    side: "long",
    sizeUsd: 20,
    leverage: 1,
    account,
    existingTrades,
  });
  assert.equal(duplicate.ok, false);
  assert(duplicate.issues.includes("symbol_already_open"));

  const maxConcurrent = validateNewPositionRisk({
    symbol: "SOL",
    side: "long",
    sizeUsd: 10,
    leverage: 1,
    account,
    existingTrades: [
      { symbol: "BTC", status: "open", sizeUsd: 10 },
      { symbol: "ETH", status: "open", sizeUsd: 10 },
      { symbol: "ARB", status: "open", sizeUsd: 10 },
    ],
  });
  assert.equal(maxConcurrent.ok, false);
  assert(maxConcurrent.issues.includes("max_concurrent_positions_reached"));

  const oversized = validateNewPositionRisk({
    symbol: "SOL",
    side: "long",
    sizeUsd: 200,
    leverage: 1,
    account,
    existingTrades: [],
  });
  assert.equal(oversized.ok, false);
  assert(oversized.issues.includes("size_above_withdrawable_buffer"));

  const closeMissing = validateCloseRisk({
    trade: { symbol: "ETH", status: "open" },
    account,
  });
  assert.equal(closeMissing.ok, false);
  assert(closeMissing.issues.includes("live_position_missing"));

  const exposure = validateNewPositionRisk({
    symbol: "SOL",
    side: "long",
    sizeUsd: 200,
    leverage: 1,
    account: { withdrawable: 1000 },
    existingTrades: [
      { symbol: "BTC", status: "open", sizeUsd: 1400 },
      { symbol: "ETH", status: "closed", sizeUsd: 9999 },
    ],
  });
  assert.equal(exposure.ok, false);
  assert(exposure.issues.includes("total_exposure_above_max"));

  const alreadyClosed = validateCloseRisk({
    trade: { symbol: "BTC", status: "closed" },
    account,
  });
  assert.equal(alreadyClosed.ok, false);
  assert(alreadyClosed.issues.includes("trade_already_closed"));

  const alreadyClosedMissingPosition = validateCloseRisk({
    trade: { symbol: "ETH", status: "closed" },
    account,
  });
  assert.equal(alreadyClosedMissingPosition.ok, false);
  assert(alreadyClosedMissingPosition.issues.includes("trade_already_closed"));
  assert(alreadyClosedMissingPosition.issues.includes("live_position_missing"));

  console.log("phase1 risk tests passed");
}

run();
