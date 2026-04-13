import assert from "assert";
import fs from "fs";
import { updateMarketStreamSnapshot, getMarketStreamSnapshot, listMarketStreamSnapshots } from "../market-stream-state.js";

const FILE = "./runtime-data/market-stream-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  updateMarketStreamSnapshot("BTC", { bookImbalance: 0.2, synthesisBias: "long" });
  const btc = getMarketStreamSnapshot("BTC");
  assert.equal(btc.synthesisBias, "long");
  const all = listMarketStreamSnapshots();
  assert.ok(all.symbols.BTC);
  cleanup();
  console.log("market stream state tests passed");
}

run();
