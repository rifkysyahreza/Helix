import assert from "assert";
import fs from "fs";
import { startBurnIn, recordBurnInEvent } from "../burn-in.js";
import { buildBurnInRunbookStatus } from "../burn-in-runbook.js";

const FILE = "./runtime-data/burn-in-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

async function run() {
  cleanup();
  startBurnIn({ mode: "paper", stage: "paper" });
  for (let i = 0; i < 10; i += 1) recordBurnInEvent({ successfulExecution: true, paperCycle: true });
  const status = await buildBurnInRunbookStatus();
  assert.ok(status);
  assert.ok(Object.prototype.hasOwnProperty.call(status, "recommendedAction"));
  cleanup();
  console.log("burn-in runbook tests passed");
}

run();
