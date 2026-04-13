import fs from "fs";

const FILE = "./runtime-data/trade-stream-state.json";
const MAX_TRADES = 500;

function load() {
  if (!fs.existsSync(FILE)) return { symbols: {}, updatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { symbols: {}, updatedAt: null };
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function appendTrades(symbol, trades = []) {
  const upper = String(symbol || "").toUpperCase();
  if (!upper) return null;
  const state = load();
  state.symbols[upper] = state.symbols[upper] || { trades: [] };
  state.symbols[upper].trades.push(...trades.map((trade) => ({ ...trade, capturedAt: new Date().toISOString() })));
  state.symbols[upper].trades = state.symbols[upper].trades.slice(-MAX_TRADES);
  save(state);
  return state.symbols[upper];
}

export function getTradeStreamState(symbol) {
  const upper = String(symbol || "").toUpperCase();
  return load().symbols[upper] || { trades: [] };
}

export function listTradeStreamState() {
  return load();
}
