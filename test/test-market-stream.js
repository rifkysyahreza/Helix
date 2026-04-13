import assert from "assert";
import { listSubscribedSymbols } from "../market-stream.js";

function run() {
  const symbols = listSubscribedSymbols();
  assert.ok(Array.isArray(symbols));
  console.log("market stream tests passed");
}

run();
