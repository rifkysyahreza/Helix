import assert from "assert";
import { buildExecutionReliabilitySummary } from "../execution-reliability.js";

function run() {
  const summary = buildExecutionReliabilitySummary(50);
  assert.ok(summary);
  assert.ok(summary.incidents);
  assert.ok(Object.prototype.hasOwnProperty.call(summary, "bySymbol"));
  assert.ok(Array.isArray(summary.worstSymbols));
  console.log("execution audit tests passed");
}

run();
