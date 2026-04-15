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
  recordBurnInEvent({ paperCycle: true, successfulExecution: true, note: "manual_maintain_completed" });
  const summary = summarizeBurnInState();
  assert.equal(summary.paperCycles, 1);
  assert.equal(summary.cycles, 1);
  assert.equal(summary.successfulExecutions, 1);
  cleanup();
  console.log("burn-in manual maintain tests passed");
}

run();
