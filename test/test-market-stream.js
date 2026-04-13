import assert from "assert";
import { listSubscribedSymbols } from "../market-stream.js";

function run() {
  const symbols = listSubscribedSymbols();
  assert.ok(symbols && typeof symbols === "object");
  assert.ok(Array.isArray(symbols.orderBooks));
  assert.ok(Array.isArray(symbols.trades));
  console.log("market stream tests passed");
}

run();
