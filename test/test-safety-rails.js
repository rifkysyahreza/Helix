import assert from "assert";
import { evaluateAutonomousSafety } from "../safety-rails.js";

function run() {
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

  console.log("safety rails tests passed");
}

run();
