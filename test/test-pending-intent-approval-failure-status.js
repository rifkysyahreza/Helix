import assert from "assert";
import fs from "fs";
import { addPendingIntent, resolvePendingIntent } from "../pending-intents.js";

const FILE = "./runtime-data/pending-intents.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  const pending = addPendingIntent({
    source: "close_position",
    coin: "BTC",
    side: "long",
    tradeId: "trade-1",
    intent: { type: "close_position", symbol: "BTC", side: "long", tradeId: "trade-1" },
  });
  const resolved = resolvePendingIntent(pending.id, "approval_failed", { requestedDecision: "approved" });
  assert.equal(resolved.status, "approval_failed");
  assert.equal(resolved.requestedDecision, "approved");
  console.log("pending intent approval failure status tests passed");
}

run();
