import fs from "fs";
import os from "os";
import path from "path";

export function setupIsolatedTestEnv(prefix = "helix-test-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const runtimeDir = path.join(root, "runtime-data");
  fs.mkdirSync(runtimeDir, { recursive: true });

  process.env.HELIX_STATE_FILE = path.join(root, "state.json");
  process.env.HELIX_RUNTIME_DATA_DIR = runtimeDir;
  process.env.HELIX_BURN_IN_FILE = path.join(runtimeDir, "burn-in-state.json");
  process.env.HELIX_EXECUTION_INCIDENTS_FILE = path.join(runtimeDir, "execution-incidents.jsonl");
  process.env.HELIX_PENDING_INTENTS_FILE = path.join(runtimeDir, "pending-intents.json");
  process.env.HELIX_RUNTIME_RESILIENCE_FILE = path.join(runtimeDir, "runtime-resilience.json");
  process.env.HELIX_HEALTH_SUMMARY_FILE = path.join(runtimeDir, "health-summary.json");
  process.env.HELIX_OPERATOR_CONTROLS_FILE = path.join(runtimeDir, "operator-controls.json");
  process.env.HELIX_MARKET_STREAM_STATE_FILE = path.join(runtimeDir, "market-stream-state.json");
  process.env.HELIX_AUTONOMY_SESSION_STATE_FILE = path.join(runtimeDir, "autonomy-session-state.json");
  process.env.HELIX_STREAM_RUNTIME_STATE_FILE = path.join(runtimeDir, "stream-runtime-state.json");
  process.env.HELIX_TRADE_STREAM_STATE_FILE = path.join(runtimeDir, "trade-stream-state.json");
  process.env.HELIX_MICROSTRUCTURE_STATE_FILE = path.join(runtimeDir, "microstructure-state.json");

  return { root, runtimeDir };
}
