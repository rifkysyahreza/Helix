import assert from "assert";
import fs from "fs";
import { startBurnIn, stopBurnIn, recordBurnInEvent, summarizeBurnInState } from "../burn-in.js";

const FILE = "./runtime-data/burn-in-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  startBurnIn({ mode: "approval", note: "test start" });
  for (let i = 0; i < 5; i += 1) {
    recordBurnInEvent({ successfulExecution: true });
  }
  const summary = summarizeBurnInState();
  assert.equal(summary.enabled, true);
  assert.equal(summary.cycles, 5);
  assert.equal(summary.promotionReady, true);

  stopBurnIn({ note: "test stop" });
  const stopped = summarizeBurnInState();
  assert.equal(stopped.enabled, false);

  cleanup();
  console.log("burn-in tests passed");
}

run();
