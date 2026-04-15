import assert from "assert";
import fs from "fs";
import { startBurnIn, recordBurnInEvent, summarizeBurnInState } from "../burn-in.js";

const FILE = "./runtime-data/burn-in-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  startBurnIn({ mode: "paper", stage: "paper" });
  recordBurnInEvent({ paperCycle: true, successfulExecution: true, note: "observer_cycle_completed" });
  recordBurnInEvent({ paperCycle: true, successfulExecution: true, note: "management_cycle_completed" });
  const summary = summarizeBurnInState();
  assert.equal(summary.paperCycles, 2);
  assert.equal(summary.cycles, 2);
  cleanup();
  console.log("burn-in runtime integration tests passed");
}

run();
