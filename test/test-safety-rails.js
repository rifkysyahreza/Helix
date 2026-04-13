import assert from "assert";
import fs from "fs";
import { createTradeRecord, closeTradeRecord } from "../state.js";
import { evaluateAutonomousSafety } from "../safety-rails.js";

const STATE_FILE = "./state.json";
const SESSION_FILE = "./runtime-data/autonomy-session-state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}

function run() {
  cleanup();
  const iocBlocked = evaluateAutonomousSafety({
    account: { withdrawable: 1000 },
    symbol: "BTC",
    executionReliability: { total: 3, reliabilityScore: 0.1, ioc_cancel: 2, error: 0 },
  });
  assert.equal(iocBlocked.allowAutonomous, false);
  assert(iocBlocked.reasons.includes("ioc_cancel_streak"));

  const errorBlocked = evaluateAutonomousSafety({
    account: { withdrawable: 1000 },
    symbol: "ETH",
    executionReliability: { total: 4, reliabilityScore: 0.2, ioc_cancel: 0, error: 2 },
  });
  assert.equal(errorBlocked.allowAutonomous, false);
  assert(errorBlocked.reasons.includes("execution_error_streak"));

  const healthy = evaluateAutonomousSafety({
    account: { withdrawable: 1000 },
    symbol: "SOL",
    executionReliability: { total: 4, reliabilityScore: 0.75, ioc_cancel: 0, error: 0 },
  });
  assert.equal(healthy.allowAutonomous, true);

  const portfolioDegraded = evaluateAutonomousSafety({
    account: { withdrawable: 1000, marginSummary: { totalMarginUsed: 850 } },
    symbol: "BTC",
    executionReliability: { total: 4, reliabilityScore: 0.75, ioc_cancel: 0, error: 0 },
  });
  assert.equal(portfolioDegraded.allowAutonomous, false);
  assert(portfolioDegraded.reasons.includes("portfolio_hard_brake"));

  const a = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "a", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const b = createTradeRecord({ symbol: "ETH", side: "long", sizeUsd: 100, thesis: "b", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  closeTradeRecord(a.tradeId, { realizedPnlPct: -4 });
  closeTradeRecord(b.tradeId, { realizedPnlPct: -3 });
  const sessionLocked = evaluateAutonomousSafety({
    account: { withdrawable: 1000, marginSummary: { totalMarginUsed: 200 } },
    symbol: "BTC",
    executionReliability: { total: 4, reliabilityScore: 0.75, ioc_cancel: 0, error: 0 },
  });
  assert.equal(sessionLocked.allowAutonomous, false);
  assert(sessionLocked.reasons.includes("daily_loss_lockout"));

  cleanup();
  console.log("safety rails tests passed");
}

run();
