import fs from "fs";
import path from "path";
import { getRuntimeDataFile } from "./storage-paths.js";

const FILE = getRuntimeDataFile("stream-runtime-state.json", "HELIX_STREAM_RUNTIME_STATE_FILE");

function load() {
  if (!fs.existsSync(FILE)) return { reconnects: 0, failures: [], symbols: {}, updatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { reconnects: 0, failures: [], symbols: {}, updatedAt: null };
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function markStreamSubscription(symbol, kind) {
  const state = load();
  state.symbols[symbol] = { ...(state.symbols[symbol] || {}), [kind]: { subscribedAt: new Date().toISOString(), active: true } };
  save(state);
  return state;
}

export function markStreamFailure(symbol, kind, error) {
  const state = load();
  state.failures.push({ symbol, kind, error: error?.message || String(error || "unknown_error"), at: new Date().toISOString() });
  state.symbols[symbol] = { ...(state.symbols[symbol] || {}), [kind]: { ...(state.symbols[symbol]?.[kind] || {}), active: false, failedAt: new Date().toISOString() } };
  save(state);
  return state;
}

export function markStreamReconnect(symbol, kind) {
  const state = load();
  state.reconnects = Number(state.reconnects || 0) + 1;
  state.symbols[symbol] = { ...(state.symbols[symbol] || {}), [kind]: { ...(state.symbols[symbol]?.[kind] || {}), active: true, reconnectedAt: new Date().toISOString() } };
  save(state);
  return state;
}

export function getStreamRuntimeState() {
  return load();
}
