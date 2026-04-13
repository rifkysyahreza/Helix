import assert from "assert";
import fs from "fs";
import { createTradeRecord, closeTradeRecord } from "../state.js";
import { buildPortfolioRiskProfile } from "../portfolio-risk.js";

const STATE_FILE = "./state.json";

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

function run() {
  cleanup();
  const a = createTradeRecord({ symbol: "BTC", side: "long", sizeUsd: 200, thesis: "a", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  const b = createTradeRecord({ symbol: "ETH", side: "long", sizeUsd: 200, thesis: "b", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  closeTradeRecord(a.tradeId, { realizedPnlPct: -2 });
  closeTradeRecord(b.tradeId, { realizedPnlPct: -3 });
  const c = createTradeRecord({ symbol: "SOL", side: "long", sizeUsd: 250, thesis: "c", stopLossPct: 1, takeProfitPct: 2, snapshot: {} });
  closeTradeRecord(c.tradeId, { realizedPnlPct: -1 });

  const profile = buildPortfolioRiskProfile({ account: { withdrawable: 1000, marginSummary: { totalMarginUsed: 700 } } });
  assert.equal(profile.autonomyLevel, "degraded");
  assert(profile.reasons.includes("high_margin_utilization"));
  assert(profile.reasons.includes("loss_streak"));
  cleanup();
  console.log("portfolio risk tests passed");
}

run();
