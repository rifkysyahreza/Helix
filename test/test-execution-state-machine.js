import assert from "assert";
import { inferExecutionPhase, deriveExchangePhase, EXECUTION_PHASES } from "../execution-state-machine.js";

function run() {
  assert.equal(
    inferExecutionPhase({ action: "open", verification: { executionLabel: "resting", restingCount: 1 }, hasOpenOrder: true, remainingSize: 100, tradeStatus: "open" }),
    EXECUTION_PHASES.OPEN_RESTING,
  );

  assert.equal(
    inferExecutionPhase({ action: "open", verification: { executionLabel: "partial_fill" }, hasOpenOrder: true, remainingSize: 40, tradeStatus: "open" }),
    EXECUTION_PHASES.OPEN_PARTIAL,
  );

  assert.equal(
    inferExecutionPhase({ action: "reduce", verification: { executionLabel: "filled" }, hasOpenOrder: false, remainingSize: 10, tradeStatus: "open" }),
    EXECUTION_PHASES.REDUCE_PARTIAL,
  );

  assert.equal(
    inferExecutionPhase({ action: "close", verification: { executionLabel: "filled" }, hasOpenOrder: false, remainingSize: 0, tradeStatus: "closed" }),
    EXECUTION_PHASES.CLOSED,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "partially_filled", tradeStatus: "open", hasOpenOrder: true, remainingCloseSize: 5, lastIntentAction: "close" }),
    EXECUTION_PHASES.CLOSE_PARTIAL,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "cancelled", tradeStatus: "open", hasOpenOrder: false, remainingReduceSize: 0, lastIntentAction: "reduce" }),
    EXECUTION_PHASES.REDUCE_FILLED,
  );

  assert.equal(
    deriveExchangePhase({ exchangeState: "filled", tradeStatus: "closed", hasOpenOrder: false }),
    EXECUTION_PHASES.CLOSED,
  );

  console.log("execution state machine tests passed");
}

run();
