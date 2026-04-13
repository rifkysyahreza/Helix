import assert from "assert";
import { analyzeMultiTimeframe } from "../analyzers/multi-timeframe.js";

function run() {
  const up = [
    { o: 100, h: 102, l: 99, c: 101 },
    { o: 101, h: 103, l: 100, c: 102 },
    { o: 102, h: 104, l: 101, c: 103 },
    { o: 103, h: 105, l: 102, c: 104 },
    { o: 104, h: 106, l: 103, c: 105 },
  ];
  const result = analyzeMultiTimeframe({ lower: up, primary: up, higher: up });
  assert.equal(result.bias, "long");
  assert.equal(result.alignment, "aligned");
  console.log("multi timeframe tests passed");
}

run();
