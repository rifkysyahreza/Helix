import assert from "assert";
import fs from "fs";
import { markRuntimeStart, evaluateRuntimeWatchdog } from "../runtime-resilience.js";
import { runStartupRecovery } from "../startup-recovery.js";

const FILE = "./runtime-data/runtime-resilience.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function incidentCount() {
  if (!fs.existsSync(INCIDENTS_FILE)) return 0;
  return fs.readFileSync(INCIDENTS_FILE, "utf8").trim().split("\n").filter(Boolean).length;
}

async function run() {
  cleanup();
  markRuntimeStart();
  const before = incidentCount();
  evaluateRuntimeWatchdog();
  await runStartupRecovery({ autoAct: false, previewOnly: true });
  const after = incidentCount();
  assert.equal(before, after);
  cleanup();
  console.log("runtime watchdog noise tests passed");
}

run();
