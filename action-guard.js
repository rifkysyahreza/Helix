import fs from "fs";

const ACTION_GUARD_FILE = "./runtime-data/action-guard.json";
const DEFAULT_COOLDOWN_MS = Number(process.env.HELIX_ACTION_COOLDOWN_MS || 15 * 60 * 1000);

function loadGuard() {
  if (!fs.existsSync(ACTION_GUARD_FILE)) return { actions: {} };
  try {
    return JSON.parse(fs.readFileSync(ACTION_GUARD_FILE, "utf8"));
  } catch {
    return { actions: {} };
  }
}

function saveGuard(data) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync(ACTION_GUARD_FILE, JSON.stringify(data, null, 2));
}

export function canEmitAction(key) {
  const data = loadGuard();
  const now = Date.now();
  const lastTs = data.actions[key] || 0;
  return (now - lastTs) >= DEFAULT_COOLDOWN_MS;
}

export function markActionEmitted(key) {
  const data = loadGuard();
  data.actions[key] = Date.now();
  saveGuard(data);
}
