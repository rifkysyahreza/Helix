import fs from "fs";
import path from "path";
import { getRuntimeDataFile } from "./storage-paths.js";

const STREAM_FILE = getRuntimeDataFile("market-stream-state.json", "HELIX_MARKET_STREAM_STATE_FILE");

function load() {
  if (!fs.existsSync(STREAM_FILE)) return { symbols: {}, updatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(STREAM_FILE, "utf8"));
  } catch {
    return { symbols: {}, updatedAt: null };
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STREAM_FILE, JSON.stringify(state, null, 2));
}

export function updateMarketStreamSnapshot(symbol, snapshot) {
  const state = load();
  state.symbols[symbol] = {
    ...(state.symbols[symbol] || {}),
    ...snapshot,
    at: new Date().toISOString(),
  };
  save(state);
  return state.symbols[symbol];
}

export function getMarketStreamSnapshot(symbol) {
  return load().symbols[symbol] || null;
}

export function listMarketStreamSnapshots() {
  return load();
}

export function clearMarketStreamSnapshots(symbols = null) {
  const state = load();
  if (Array.isArray(symbols) && symbols.length) {
    for (const symbol of symbols) delete state.symbols[symbol];
  } else {
    state.symbols = {};
  }
  save(state);
  return state;
}
