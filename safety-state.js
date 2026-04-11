import fs from "fs";

const SAFETY_STATE_FILE = "./runtime-data/safety-state.json";

function loadState() {
  if (!fs.existsSync(SAFETY_STATE_FILE)) return { symbols: {} };
  try {
    return JSON.parse(fs.readFileSync(SAFETY_STATE_FILE, "utf8"));
  } catch {
    return { symbols: {} };
  }
}

function saveState(data) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync(SAFETY_STATE_FILE, JSON.stringify(data, null, 2));
}

export function setSymbolSafetyHold(symbol, payload) {
  const data = loadState();
  data.symbols[symbol] = {
    ...(data.symbols[symbol] || {}),
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  saveState(data);
  return data.symbols[symbol];
}

export function getSymbolSafetyHold(symbol) {
  return loadState().symbols[symbol] || null;
}

export function clearSymbolSafetyHold(symbol) {
  const data = loadState();
  delete data.symbols[symbol];
  saveState(data);
}
