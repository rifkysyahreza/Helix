import assert from "assert";
import fs from "fs";
import { setupIsolatedTestEnv } from "./test-env.js";

setupIsolatedTestEnv("helix-burn-in-protocol-");
const { startBurnIn, recordBurnInEvent } = await import("../burn-in.js");
const { buildBurnInProtocolSummary } = await import("../burn-in-protocol.js");

const FILE = process.env.HELIX_BURN_IN_FILE;

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
