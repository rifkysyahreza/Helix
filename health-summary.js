import fs from "fs";
import { listRecentTrades } from "./state.js";
import { listPendingIntents } from "./pending-intents.js";
import { getOperatorControls } from "./operator-controls.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { reconcileExecutionLeftovers } from "./reconciliation.js";
import { buildGoLiveCheck } from "./go-live-check.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";
import { getNormalizedAccountState } from "./account-state.js";
import { summarizeExecutionIncidents } from "./execution-incidents.js";
import { evaluateRuntimeWatchdog, getRuntimeResilienceState } from "./runtime-resilience.js";
import { runStartupRecovery } from "./startup-recovery.js";
import { evaluateStreamHealth } from "./stream-health.js";
import { getStreamSubscriptionsRuntime } from "./market-stream.js";
import { buildAutonomySessionState } from "./autonomy-session-state.js";
import { buildBurnInProtocolSummary } from "./burn-in-protocol.js";
import { config } from "./config.js";

export async function buildHealthSummary({ limit = 100 } = {}) {
  const trades = listRecentTrades(limit);
  const pendingIntents = listPendingIntents();
  const controls = getOperatorControls();
  const currentMode = config.execution.mode || "paper";
  const reliability = buildExecutionReliabilitySummary(300, { mode: currentMode });
  const account = await getNormalizedAccountState().catch(() => null);
  const reconciliation = await reconcileExecutionLeftovers(limit).catch(() => null);
  const goLive = await buildGoLiveCheck().catch(() => null);
  const perf = getPerformanceProfileSummary();
  const incidents = summarizeExecutionIncidents(200, { mode: currentMode });
  const runtimeResilience = getRuntimeResilienceState();
  const watchdog = evaluateRuntimeWatchdog();
  const startupRecoveryPreview = await runStartupRecovery({ autoAct: false, previewOnly: true }).catch(() => null);
  const streamHealth = evaluateStreamHealth();
  const streamRuntime = getStreamSubscriptionsRuntime();
  const autonomySession = buildAutonomySessionState();
  const burnInProtocol = await buildBurnInProtocolSummary().catch(() => null);

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
  summaryLines.push(`Reporting mode: ${currentMode}`);
  summaryLines.push(`Go-live recommendation: ${goLive?.recommendedMode || "unknown"}`);
  summaryLines.push(`Execution incidents (${currentMode}): ${incidents.total}`);
  summaryLines.push(`Runtime watchdog stale: ${watchdog.stale}`);
  summaryLines.push(`Stream health healthy: ${streamHealth.healthy}`);
  summaryLines.push(`Stream reconnects: ${streamRuntime.reconnects || 0}`);
  summaryLines.push(`Daily lockout: ${autonomySession.dailyLockout}`);
  summaryLines.push(`Burn-in next stage: ${burnInProtocol?.nextStageRecommendation || "unknown"}`);

  if (reliability.worstSymbols?.length) {
    summaryLines.push(`Weakest execution reliability: ${reliability.worstSymbols.map((row) => `${row.symbol}:${row.reliabilityScore}`).join(" | ")}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    currentMode,
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
    incidents,
    runtimeResilience,
    watchdog,
    startupRecoveryPreview,
    streamHealth,
    streamRuntime,
    autonomySession,
    burnInProtocol,
    performance: perf,
    summaryLines,
  };

  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync("./runtime-data/health-summary.json", JSON.stringify(report, null, 2));
  return report;
}
