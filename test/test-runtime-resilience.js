import assert from "assert";
import fs from "fs";
import { setupIsolatedTestEnv } from "./test-env.js";

setupIsolatedTestEnv("helix-runtime-resilience-");
const { markRuntimeStart, markRuntimeHeartbeat, evaluateRuntimeWatchdog } = await import("../runtime-resilience.js");

const FILE = process.env.HELIX_RUNTIME_RESILIENCE_FILE;
const INCIDENTS_FILE = process.env.HELIX_EXECUTION_INCIDENTS_FILE;

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
