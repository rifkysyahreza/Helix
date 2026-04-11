import fs from "fs";

const PENDING_FILE = "./runtime-data/pending-intents.json";

function load() {
  if (!fs.existsSync(PENDING_FILE)) return { intents: [] };
  try {
    return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  } catch {
    return { intents: [] };
  }
}

function save(data) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
}

export function addPendingIntent(intent) {
  const data = load();
  const id = `intent-${Date.now()}`;
  const entry = {
    id,
    createdAt: new Date().toISOString(),
    status: "pending",
    ...intent,
  };
  data.intents.push(entry);
  save(data);
  return entry;
}

export function listPendingIntents() {
  return load().intents;
}

export function resolvePendingIntent(id, decision) {
  const data = load();
  const item = data.intents.find((intent) => intent.id === id);
  if (!item) return null;
  item.status = decision;
  item.resolvedAt = new Date().toISOString();
  save(data);
  return item;
}
