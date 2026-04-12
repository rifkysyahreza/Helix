import assert from "assert";
import { inferExecutionPhase, deriveExchangePhase, EXECUTION_PHASES } from "../execution-state-machine.js";

function run() {
  assert.equal(
    inferExecutionPhase({ action: "open", verification: { executionLabel: "resting", restingCount: 1 }, hasOpenOrder: true, remainingSize: 100, tradeStatus: "open" }),
    EXECUTION_PHASES.OPEN_RESTING,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "partially_filled", tradeStatus: "open", hasOpenOrder: true, lastIntentAction: "open" }),
    EXECUTION_PHASES.OPEN_PARTIAL,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "filled", tradeStatus: "open", hasOpenOrder: false, lastIntentAction: "open" }),
    EXECUTION_PHASES.OPEN_FILLED,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "cancelled", tradeStatus: "open", hasOpenOrder: false, lastIntentAction: "open" }),
    EXECUTION_PHASES.OPEN_CANCELLED,
  );

  assert.equal(
    inferExecutionPhase({ action: "reduce", verification: { executionLabel: "partial_fill" }, hasOpenOrder: false, remainingSize: 3, tradeStatus: "open" }),
    EXECUTION_PHASES.REDUCE_PARTIAL,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "filled", tradeStatus: "open", hasOpenOrder: false, remainingReduceSize: 0, lastIntentAction: "reduce" }),
    EXECUTION_PHASES.REDUCE_FILLED,
  );

  assert.equal(
    inferExecutionPhase({ action: "close", verification: { executionLabel: "partial_fill" }, hasOpenOrder: false, remainingSize: 1, tradeStatus: "open" }),
    EXECUTION_PHASES.CLOSE_PARTIAL,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "filled", tradeStatus: "closed", hasOpenOrder: false, remainingCloseSize: 0, lastIntentAction: "close" }),
    EXECUTION_PHASES.CLOSED,
  );

  console.log("execution transition tests passed");
}

run();
