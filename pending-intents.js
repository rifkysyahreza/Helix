import fs from "fs";
import { getPendingIntentTtlMs } from "./operator-controls.js";

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

function findDuplicatePendingIntent(intents, intent) {
  return intents.find((item) => {
    if (item.status !== "pending") return false;
    if (item.source !== intent.source) return false;
    if ((item.tradeId || null) !== (intent.tradeId || null)) return false;
    if ((item.coin || null) !== (intent.coin || null)) return false;
    if ((item.side || null) !== (intent.side || null)) return false;
    return JSON.stringify(item.intent || {}) === JSON.stringify(intent.intent || {});
  }) || null;
}

export function addPendingIntent(intent) {
  const data = load();
  const duplicate = findDuplicatePendingIntent(data.intents, intent);
  if (duplicate) {
    return {
      ...duplicate,
      deduped: true,
    };
  }

  const now = new Date();
  const id = `intent-${Date.now()}`;
  const ttlMs = getPendingIntentTtlMs();
  const entry = {
    id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    status: "pending",
    transitionHistory: [
      {
        at: now.toISOString(),
        status: "pending",
      }
    ],
    ...intent,
  };
  data.intents.push(entry);
  save(data);
  return entry;
}

export function listPendingIntents() {
  const data = load();
  const now = Date.now();
  let changed = false;

  for (const item of data.intents) {
    if (item.status === "pending" && item.expiresAt && now > new Date(item.expiresAt).getTime()) {
      item.status = "expired";
      item.expiredAt = new Date().toISOString();
      item.transitionHistory = item.transitionHistory || [];
      item.transitionHistory.push({ at: item.expiredAt, status: "expired" });
      changed = true;
    }
  }

  if (changed) save(data);
  return data.intents;
}

export function getPendingIntent(id) {
  return listPendingIntents().find((intent) => intent.id === id) || null;
}

export function markReplayAttempt(id, replayMeta = {}) {
  const data = load();
  const item = data.intents.find((intent) => intent.id === id);
  if (!item) return null;
  item.replayAttemptedAt = new Date().toISOString();
  item.replayMeta = { ...(item.replayMeta || {}), ...(replayMeta || {}) };
  item.transitionHistory = item.transitionHistory || [];
  item.transitionHistory.push({ at: item.replayAttemptedAt, status: "replay_attempted", replayMeta: item.replayMeta });
  save(data);
  return item;
}

export function resolvePendingIntent(id, decision, extra = {}) {
  const data = load();
  const item = data.intents.find((intent) => intent.id === id);
  if (!item) return null;
  if (item.status !== "pending") return item;
  item.status = decision;
  item.resolvedAt = new Date().toISOString();
  item.transitionHistory = item.transitionHistory || [];
  item.transitionHistory.push({ at: item.resolvedAt, status: decision });
  Object.assign(item, extra || {});
  save(data);
  return item;
}
