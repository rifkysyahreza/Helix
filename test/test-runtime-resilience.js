import assert from "assert";
import fs from "fs";
import { markRuntimeStart, markRuntimeHeartbeat, evaluateRuntimeWatchdog } from "../runtime-resilience.js";

const FILE = "./runtime-data/runtime-resilience.json";
const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function run() {
  cleanup();
  const started = markRuntimeStart();
  assert.ok(started.startedAt);
  const heartbeat = markRuntimeHeartbeat();
  assert.ok(heartbeat.lastHeartbeatAt);
  const watchdog = evaluateRuntimeWatchdog({ staleMs: 60 * 60 * 1000 });
  assert.equal(watchdog.stale, false);
  cleanup();
  console.log("runtime resilience tests passed");
}

run();
