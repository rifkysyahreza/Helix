import { listRecentTrades } from "./state.js";

export function buildCompoundingContext(limit = 200) {
  const trades = listRecentTrades(limit).filter((trade) => trade.status === "closed");
  const closedWithPnl = trades.filter((trade) => typeof trade.realizedPnlPct === "number");

  const avgSizeUsd = closedWithPnl.length
    ? closedWithPnl.reduce((sum, trade) => sum + Number(trade.sizeUsd || 0), 0) / closedWithPnl.length
    : null;

  const avgPnlPct = closedWithPnl.length
    ? closedWithPnl.reduce((sum, trade) => sum + Number(trade.realizedPnlPct || 0), 0) / closedWithPnl.length
    : null;

  const recentWins = closedWithPnl.filter((trade) => (trade.realizedPnlPct || 0) > 0).slice(0, 5);
  const recentLosses = closedWithPnl.filter((trade) => (trade.realizedPnlPct || 0) < 0).slice(0, 5);

  let compoundingBias = "neutral";
  let sizeMultiplier = 1;
  let note = "Not enough evidence yet to adjust for compounding.";

  if (avgPnlPct != null) {
    if (avgPnlPct >= 2) {
      compoundingBias = "press_winners_carefully";
      sizeMultiplier = 1.1;
      note = "Recent average pnl supports modest size compounding, but keep it controlled.";
    } else if (avgPnlPct <= -2) {
      compoundingBias = "de_risk_after_drawdown";
      sizeMultiplier = 0.85;
      note = "Recent average pnl suggests slowing the snowball and reducing size until performance improves.";
    }
  }

  return {
    avgSizeUsd,
    avgPnlPct,
    recentWins: recentWins.length,
    recentLosses: recentLosses.length,
    compoundingBias,
    sizeMultiplier,
    note,
  };
}
