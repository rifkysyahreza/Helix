import assert from "assert";
import fs from "fs";
import { markRuntimeStart } from "../runtime-resilience.js";
import { runStartupRecovery } from "../startup-recovery.js";

const FILE = "./runtime-data/runtime-resilience.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

async function run() {
  cleanup();
  markRuntimeStart();
  const recovered = await runStartupRecovery({ autoAct: false });
  assert.equal(typeof recovered.recovered, "boolean");
  cleanup();
  console.log("startup recovery tests passed");
}

run();
