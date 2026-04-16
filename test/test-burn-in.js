import assert from "assert";
import fs from "fs";
import { setupIsolatedTestEnv } from "./test-env.js";

const { root } = setupIsolatedTestEnv("helix-burn-in-");
const { startBurnIn, stopBurnIn, recordBurnInEvent, summarizeBurnInState } = await import("../burn-in.js");

const FILE = process.env.HELIX_BURN_IN_FILE;

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
