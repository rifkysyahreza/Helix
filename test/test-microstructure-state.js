import assert from "assert";
import fs from "fs";
import { appendMicrostructureSample, getMicrostructureSamples } from "../microstructure-state.js";

const FILE = "./runtime-data/microstructure-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  appendMicrostructureSample("BTC", { imbalance: 0.2, spreadPct: 0.02 });
  const state = getMicrostructureSamples("BTC");
  assert.equal(state.samples.length, 1);
  cleanup();
  console.log("microstructure state tests passed");
}

run();
