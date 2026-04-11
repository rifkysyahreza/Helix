import fs from "fs";
import { listRecentTrades } from "./state.js";

const PROFILE_FILE = "./runtime-data/performance-profile.json";

function ensureDir() {
  fs.mkdirSync("./runtime-data", { recursive: true });
}

export function buildPerformanceProfile(limit = 200) {
  const trades = listRecentTrades(limit).filter((trade) => trade.status === "closed");
  const bySymbol = {};
  const byOutcome = {
    big_profit: 0,
    small_profit: 0,
    small_loss: 0,
    big_loss: 0,
    flat: 0,
    unknown: 0,
  };

  for (const trade of trades) {
    const pnl = trade.realizedPnlPct;
    const outcome = pnl == null
      ? "unknown"
      : pnl >= 5 ? "big_profit"
      : pnl > 0 ? "small_profit"
      : pnl <= -5 ? "big_loss"
      : pnl < 0 ? "small_loss"
      : "flat";

    byOutcome[outcome] += 1;

    if (!bySymbol[trade.symbol]) {
      bySymbol[trade.symbol] = { count: 0, avgPnlPct: 0, wins: 0, losses: 0 };
    }
    bySymbol[trade.symbol].count += 1;
    bySymbol[trade.symbol].avgPnlPct += pnl || 0;
    if ((pnl || 0) > 0) bySymbol[trade.symbol].wins += 1;
    if ((pnl || 0) < 0) bySymbol[trade.symbol].losses += 1;
  }

  for (const symbol of Object.keys(bySymbol)) {
    bySymbol[symbol].avgPnlPct = bySymbol[symbol].count
      ? bySymbol[symbol].avgPnlPct / bySymbol[symbol].count
      : 0;
  }

  const profile = {
    generatedAt: new Date().toISOString(),
    totalClosedTrades: trades.length,
    byOutcome,
    bySymbol,
  };

  ensureDir();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2));
  return profile;
}

export function loadPerformanceProfile() {
  if (!fs.existsSync(PROFILE_FILE)) {
    return buildPerformanceProfile();
  }
  try {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
  } catch {
    return buildPerformanceProfile();
  }
}

export function getPerformanceProfileSummary() {
  const profile = loadPerformanceProfile();
  const strongestSymbols = Object.entries(profile.bySymbol)
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => b[1].avgPnlPct - a[1].avgPnlPct)
    .slice(0, 3)
    .map(([symbol, stats]) => `${symbol}: avg ${stats.avgPnlPct.toFixed(2)}% over ${stats.count} trade(s)`);

  const weakestSymbols = Object.entries(profile.bySymbol)
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => a[1].avgPnlPct - b[1].avgPnlPct)
    .slice(0, 3)
    .map(([symbol, stats]) => `${symbol}: avg ${stats.avgPnlPct.toFixed(2)}% over ${stats.count} trade(s)`);

  return {
    profile,
    summaryLines: [
      `Closed trades: ${profile.totalClosedTrades}`,
      `Outcome buckets: ${JSON.stringify(profile.byOutcome)}`,
      strongestSymbols.length ? `Strongest symbols: ${strongestSymbols.join(" | ")}` : null,
      weakestSymbols.length ? `Weakest symbols: ${weakestSymbols.join(" | ")}` : null,
    ].filter(Boolean),
  };
}
