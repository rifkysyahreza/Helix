import fs from "fs";
import path from "path";
import { listRecentTrades } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { getRuntimeDataFile } from "./storage-paths.js";

const FILE = getRuntimeDataFile("runtime-resilience.json", "HELIX_RUNTIME_RESILIENCE_FILE");

function defaultState() {
  return {
    startedAt: null,
    lastHeartbeatAt: null,
    restarts: 0,
    dirtyRestartDetected: false,
    openTradesAtStart: [],
    lastWatchdogIncidentAt: null,
  };
}

function load() {
  if (!fs.existsSync(FILE)) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return defaultState();
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function markRuntimeStart() {
  const state = load();
  const openTrades = listRecentTrades(200).filter((trade) => trade.status === "open");
  const dirtyRestartDetected = Boolean(state.startedAt && openTrades.length > 0);
  const now = new Date().toISOString();
  const next = {
    ...state,
    startedAt: now,
    lastHeartbeatAt: now,
    restarts: Number(state.restarts || 0) + 1,
    dirtyRestartDetected,
    openTradesAtStart: openTrades.map((trade) => ({ tradeId: trade.tradeId, symbol: trade.symbol, lifecyclePhase: trade.lifecyclePhase })),
  };
  save(next);
  if (dirtyRestartDetected) {
    recordExecutionIncident({ kind: "runtime_dirty_restart_detected", openTrades: next.openTradesAtStart });
  }
  return next;
}

export function markRuntimeHeartbeat() {
  const state = load();
  state.lastHeartbeatAt = new Date().toISOString();
  save(state);
  return state;
}

export function getRuntimeResilienceState() {
  return load();
}

export function evaluateRuntimeWatchdog({ staleMs = 10 * 60 * 1000, recordIncident = false, dedupeMs = 5 * 60 * 1000 } = {}) {
  const state = load();
  const last = state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).getTime() : null;
  const stale = !last || (Date.now() - last) > staleMs;

  if (stale && recordIncident) {
    const lastIncidentAt = state.lastWatchdogIncidentAt ? new Date(state.lastWatchdogIncidentAt).getTime() : null;
    const shouldRecord = !lastIncidentAt || (Date.now() - lastIncidentAt) > dedupeMs;
    if (shouldRecord) {
      recordExecutionIncident({ kind: "runtime_watchdog_stale", lastHeartbeatAt: state.lastHeartbeatAt || null, staleMs });
      state.lastWatchdogIncidentAt = new Date().toISOString();
      save(state);
    }
  }

  return {
    stale,
    staleMs,
    lastHeartbeatAt: state.lastHeartbeatAt || null,
    dirtyRestartDetected: Boolean(state.dirtyRestartDetected),
    restarts: Number(state.restarts || 0),
  };
}
