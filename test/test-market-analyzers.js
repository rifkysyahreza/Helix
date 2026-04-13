import assert from "assert";
import { analyzeMarketStructure } from "../analyzers/market-structure.js";
import { analyzeVolatility } from "../analyzers/volatility.js";

function run() {
  const uptrend = [
    { o: 100, h: 102, l: 99, c: 101, v: 10 },
    { o: 101, h: 103, l: 100, c: 102, v: 11 },
    { o: 102, h: 104, l: 101, c: 103, v: 12 },
    { o: 103, h: 105, l: 102, c: 104, v: 13 },
    { o: 104, h: 106, l: 103, c: 105, v: 14 },
  ];

  const structure = analyzeMarketStructure(uptrend);
  assert.equal(structure.regime, "trend");
  assert.equal(structure.trendBias, "long");

  const volatility = analyzeVolatility([
    { o: 100, h: 101, l: 99.8, c: 100.5 },
    { o: 100.5, h: 101, l: 100.1, c: 100.7 },
    { o: 100.7, h: 101, l: 100.4, c: 100.8 },
    { o: 100.8, h: 101.1, l: 100.6, c: 100.9 },
    { o: 100.9, h: 101.2, l: 100.7, c: 101.0 },
    { o: 101.0, h: 103.5, l: 100.8, c: 103.2 },
    { o: 103.2, h: 106.2, l: 102.8, c: 105.8 },
    { o: 105.8, h: 109.5, l: 105.1, c: 108.9 },
    { o: 108.9, h: 112.8, l: 108.4, c: 111.9 },
    { o: 111.9, h: 116.5, l: 111.1, c: 115.4 },
  ]);
  assert.equal(volatility.regime, "expansion");
  assert.equal(volatility.expansion, true);

  console.log("market analyzer tests passed");
}

run();
