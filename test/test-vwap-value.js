import assert from "assert";
import { analyzeVwapAndValue } from "../analyzers/vwap-value.js";

function run() {
  const candles = [
    { o: 100, h: 102, l: 99, c: 101, v: 10 },
    { o: 101, h: 103, l: 100, c: 102, v: 20 },
    { o: 102, h: 104, l: 101, c: 103, v: 30 },
    { o: 103, h: 105, l: 102, c: 104, v: 25 },
    { o: 104, h: 106, l: 103, c: 105, v: 15 },
  ];

  const result = analyzeVwapAndValue(candles);
  assert.ok(result.vwap);
  assert.ok(result.poc);
  assert.ok(result.valueAreaLow != null);
  assert.ok(result.valueAreaHigh != null);
  assert.ok(["inside_value", "above_value", "below_value"].includes(result.location));

  console.log("vwap value tests passed");
}

run();
