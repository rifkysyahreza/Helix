import assert from "assert";
import fs from "fs";
import { createTradeRecord, closeTradeRecord } from "../state.js";
import { buildAutonomySessionState } from "../autonomy-session-state.js";

const STATE_FILE = "./state.json";
const FILE = "./runtime-data/autonomy-session-state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

function run() {
  cleanup();
  const a = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 100, thesis: "a", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  closeTradeRecord(a.tradeId, { realizedPnlPct: -4 });
  const b = createTradeRecord({ symbol: "ETH", side: "long", sizeUsd: 100, thesis: "b", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  closeTradeRecord(b.tradeId, { realizedPnlPct: -3 });
  const session = buildAutonomySessionState();
  assert.equal(session.dailyLockout, true);
  assert.equal(session.sessionDegraded, true);
  assert.ok(Array.isArray(session.reasons));
  assert.ok(session.reasons.includes("daily_loss_lockout"));
  cleanup();
  console.log("autonomy session state tests passed");
}

run();
