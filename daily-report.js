import fs from "fs";
import { listRecentTrades } from "./state.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";

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

  const wins = closedYesterday.filter((trade) => (trade.realizedPnlPct || 0) > 0).length;
  const losses = closedYesterday.filter((trade) => (trade.realizedPnlPct || 0) < 0).length;
  const avg = closedYesterday.length
    ? closedYesterday.reduce((sum, trade) => sum + (trade.realizedPnlPct || 0), 0) / closedYesterday.length
    : null;

  lines.push(`Wins: ${wins} | Losses: ${losses} | Avg PnL: ${avg != null ? avg.toFixed(2) : "n/a"}%`);

  for (const trade of closedYesterday) {
    lines.push(`${trade.symbol} ${trade.side} -> ${trade.realizedPnlPct ?? "n/a"}% (${trade.closeReason || "no reason"})`);
  }

  lines.push(...perf.summaryLines);

  const report = {
    generatedAt: new Date().toISOString(),
    closedYesterday,
    summaryLines: lines,
  };

  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync("./runtime-data/yesterday-learning-report.json", JSON.stringify(report, null, 2));
  return report;
}
