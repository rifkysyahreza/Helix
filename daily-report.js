import fs from "fs";
import { listRecentTrades } from "./state.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";
import { getLearnedBeliefs } from "./belief-updater.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { buildCompoundingContext } from "./compounding.js";

function isYesterday(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return d.getUTCFullYear() === y.getUTCFullYear()
    && d.getUTCMonth() === y.getUTCMonth()
    && d.getUTCDate() === y.getUTCDate();
}

export function buildYesterdayLearningReport() {
  const closedYesterday = listRecentTrades(500).filter((trade) => trade.status === "closed" && isYesterday(trade.closedAt));
  const perf = getPerformanceProfileSummary();

  const lines = [];
  lines.push(`Yesterday closed trades: ${closedYesterday.length}`);
  lines.push("Operator brief:");

  const wins = closedYesterday.filter((trade) => (trade.realizedPnlPct || 0) > 0).length;
  const losses = closedYesterday.filter((trade) => (trade.realizedPnlPct || 0) < 0).length;
  const avg = closedYesterday.length
    ? closedYesterday.reduce((sum, trade) => sum + (trade.realizedPnlPct || 0), 0) / closedYesterday.length
    : null;

  lines.push(`Wins: ${wins} | Losses: ${losses} | Avg PnL: ${avg != null ? avg.toFixed(2) : "n/a"}%`);

  for (const trade of closedYesterday) {
    lines.push(`${trade.symbol} ${trade.side} -> ${trade.realizedPnlPct ?? "n/a"}% (${trade.closeReason || "no reason"})`);
  }

  const weakestBeliefs = Object.entries(getLearnedBeliefs()?.symbols || {})
    .filter(([, value]) => (value?.avgPnlPct || 0) < 0)
    .sort((a, b) => (a[1].avgPnlPct || 0) - (b[1].avgPnlPct || 0))
    .slice(0, 3);

  if (weakestBeliefs.length) {
    lines.push("Weakest learned symbols:");
    for (const [symbol, value] of weakestBeliefs) {
      lines.push(`- ${symbol}: avg ${Number(value.avgPnlPct || 0).toFixed(2)}%, wins ${value.wins || 0}, losses ${value.losses || 0}`);
    }
  }

  lines.push(...perf.summaryLines);

  const executionQuality = closedYesterday.reduce((acc, trade) => {
    const outcome = trade.executionState?.lastCloseOutcome || trade.executionState?.lastReduceOutcome || null;
    if (!outcome) return acc;
    acc[outcome] = (acc[outcome] || 0) + 1;
    return acc;
  }, {});

  if (Object.keys(executionQuality).length) {
    lines.push(`Execution quality: ${Object.entries(executionQuality).map(([k, v]) => `${k}=${v}`).join(" | ")}`);
    if (executionQuality.ioc_cancel || executionQuality.error) {
      lines.push("Execution warning: repeated IOC cancels or execution errors need closer review before increasing automation.");
    }
  }

  const executionReliability = buildExecutionReliabilitySummary(300);
  const compounding = buildCompoundingContext(300);

  if (executionReliability.worstSymbols.length) {
    lines.push("Weakest execution reliability:");
    for (const row of executionReliability.worstSymbols.slice(0, 3)) {
      lines.push(`- ${row.symbol}: score ${row.reliabilityScore}, filled ${row.filled}, partial ${row.partial_fill}, ioc_cancel ${row.ioc_cancel}, error ${row.error}`);
    }
  }

  lines.push(`Compounding bias: ${compounding.compoundingBias} | size multiplier: ${compounding.sizeMultiplier} | note: ${compounding.note}`);

  const report = {
    generatedAt: new Date().toISOString(),
    closedYesterday,
    executionQuality,
    executionReliability,
    weakestBeliefs,
    compounding,
    summaryLines: lines,
  };

  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync("./runtime-data/yesterday-learning-report.json", JSON.stringify(report, null, 2));
  return report;
}
