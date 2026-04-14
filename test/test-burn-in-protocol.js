import assert from "assert";
import fs from "fs";
import { startBurnIn, recordBurnInEvent } from "../burn-in.js";
import { buildBurnInProtocolSummary } from "../burn-in-protocol.js";

const FILE = "./runtime-data/burn-in-state.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

async function run() {
  cleanup();
  startBurnIn({ mode: "paper" });
  for (let i = 0; i < 10; i += 1) recordBurnInEvent({ successfulExecution: true, paperCycle: true });
  const summary = await buildBurnInProtocolSummary();
  assert.ok(summary.checklist);
  assert.ok(Array.isArray(summary.checklist.checklist));
  cleanup();
  console.log("burn-in protocol tests passed");
}

run();
