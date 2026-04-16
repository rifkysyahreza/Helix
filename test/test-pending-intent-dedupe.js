import assert from "assert";
import fs from "fs";
import { addPendingIntent, listPendingIntents } from "../pending-intents.js";

const FILE = "./runtime-data/pending-intents.json";

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  const payload = {
    source: "close_position",
    coin: "BTC",
    side: "long",
    tradeId: "trade-1",
    intent: { type: "close_position", symbol: "BTC", side: "long", tradeId: "trade-1" },
  };

  const first = addPendingIntent(payload);
  const second = addPendingIntent(payload);
  const intents = listPendingIntents();

  assert.equal(intents.length, 1);
  assert.equal(second.id, first.id);
  assert.equal(second.deduped, true);
  console.log("pending intent dedupe tests passed");
}

run();
