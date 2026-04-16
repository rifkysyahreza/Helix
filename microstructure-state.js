import fs from "fs";
import path from "path";
import { getRuntimeDataFile } from "./storage-paths.js";

const FILE = getRuntimeDataFile("microstructure-state.json", "HELIX_MICROSTRUCTURE_STATE_FILE");
const MAX_HISTORY = 200;

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

export function appendMicrostructureSample(symbol, sample) {
  const upper = String(symbol || "").toUpperCase();
  if (!upper) return null;
  const state = load();
  state.symbols[upper] = state.symbols[upper] || { samples: [] };
  state.symbols[upper].samples.push({ at: new Date().toISOString(), ...sample });
  state.symbols[upper].samples = state.symbols[upper].samples.slice(-MAX_HISTORY);
  save(state);
  return state.symbols[upper];
}

export function getMicrostructureSamples(symbol) {
  const upper = String(symbol || "").toUpperCase();
  return load().symbols[upper] || { samples: [] };
}

export function listMicrostructureState() {
  return load();
}
