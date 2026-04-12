import assert from "assert";
import { summarizeExecutionResult } from "../execution-result.js";

function run() {
  const filled = summarizeExecutionResult({
    response: {
      data: {
        statuses: [
          { filled: { oid: 123, totalSz: "1.5", avgPx: "100.25" } },
        ],
      },
    },
  });

  assert.equal(filled.executionLabel, "filled");
  assert.equal(filled.primaryOid, 123);
  assert.equal(filled.totalFilledSize, 1.5);
  assert.equal(filled.avgFillPx, 100.25);

  const partial = summarizeExecutionResult({
    response: {
      data: {
        statuses: [
          { filled: { oid: 888, totalSz: "0.25", avgPx: "99" } },
          { error: "could not immediately match against any resting orders" },
        ],
      },
    },
  });

  assert.equal(partial.executionLabel, "partial_fill");
  assert.deepEqual(partial.orderIds, [888]);

  const cancel = summarizeExecutionResult({
    data: {
      statuses: [
        { error: "IocCancel: could not immediately match against any resting orders" },
      ],
    },
  });

  assert.equal(cancel.executionLabel, "ioc_cancel");
  assert.equal(cancel.primaryOid, null);

  console.log("execution truth tests passed");
}

run();
