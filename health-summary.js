import fs from "fs";
import { listRecentTrades } from "./state.js";
import { listPendingIntents } from "./pending-intents.js";
import { getOperatorControls } from "./operator-controls.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { reconcileExecutionLeftovers } from "./reconciliation.js";
import { buildGoLiveCheck } from "./go-live-check.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";
import { getNormalizedAccountState } from "./account-state.js";

export async function buildHealthSummary({ limit = 100 } = {}) {
  const trades = listRecentTrades(limit);
  const pendingIntents = listPendingIntents();
  const controls = getOperatorControls();
  const reliability = buildExecutionReliabilitySummary(300);
  const account = await getNormalizedAccountState().catch(() => null);
  const reconciliation = await reconcileExecutionLeftovers(limit).catch(() => null);
  const goLive = await buildGoLiveCheck().catch(() => null);
  const perf = getPerformanceProfileSummary();

  const openTrades = trades.filter((trade) => trade.status === "open");
  const closedTrades = trades.filter((trade) => trade.status === "closed");
  const drifts = reconciliation?.drifts || [];
  const lifecycleRepairs = reconciliation?.lifecycleRepairs || [];

  const summaryLines = [];
  summaryLines.push(`Open trades: ${openTrades.length}`);
  summaryLines.push(`Closed trades: ${closedTrades.length}`);
  summaryLines.push(`Pending intents: ${pendingIntents.filter((item) => item.status === "pending").length}`);
  summaryLines.push(`Expired intents: ${pendingIntents.filter((item) => item.status === "expired").length}`);
  summaryLines.push(`Drift count: ${drifts.length}`);
  summaryLines.push(`Lifecycle repairs: ${lifecycleRepairs.length}`);
  summaryLines.push(`Controls: halted=${controls.halted} closeOnly=${controls.closeOnly} suspended=${Object.keys(controls.suspendedSymbols || {}).length}`);
  summaryLines.push(`Go-live recommendation: ${goLive?.recommendedMode || "unknown"}`);

  if (reliability.worstSymbols?.length) {
    summaryLines.push(`Weakest execution reliability: ${reliability.worstSymbols.map((row) => `${row.symbol}:${row.reliabilityScore}`).join(" | ")}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    account,
    controls,
    trades: {
      total: trades.length,
      open: openTrades.length,
      closed: closedTrades.length,
    },
    pendingIntents: {
      total: pendingIntents.length,
      pending: pendingIntents.filter((item) => item.status === "pending").length,
      approved: pendingIntents.filter((item) => item.status === "approved").length,
      rejected: pendingIntents.filter((item) => item.status === "rejected").length,
      expired: pendingIntents.filter((item) => item.status === "expired").length,
    },
    reliability,
    reconciliation,
    goLive,
    performance: perf,
    summaryLines,
  };

  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync("./runtime-data/health-summary.json", JSON.stringify(report, null, 2));
  return report;
}
