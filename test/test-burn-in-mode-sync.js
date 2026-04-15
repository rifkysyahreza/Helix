import assert from "assert";
import fs from "fs";
import { startBurnIn, syncBurnInMode, summarizeBurnInState } from "../burn-in.js";

const FILE = "./runtime-data/burn-in-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  startBurnIn({ mode: "paper", stage: "paper" });
  syncBurnInMode({ mode: "approval", stage: "approval", note: "runtime_mode_synced_approval" });
  const summary = summarizeBurnInState();
  assert.equal(summary.mode, "approval");
  assert.equal(summary.stage, "approval");
  assert.equal(summary.enabled, true);
  cleanup();
  console.log("burn-in mode sync tests passed");
}

run();
