import { listRecentTrades } from "./state.js";

export function buildCompoundingContext({ limit = 200, account = null } = {}) {
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

  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  const accountValue = account?.marginSummary?.accountValue != null ? Number(account.marginSummary.accountValue) : null;
  const accountBuffer = withdrawable ?? accountValue ?? null;

  if (accountBuffer != null) {
    if (accountBuffer < 100) {
      compoundingBias = "capital_preservation";
      sizeMultiplier = Math.min(sizeMultiplier, 0.75);
      note = "Account buffer is thin, so Helix should protect capital and keep size tight.";
    } else if (accountBuffer > 1000 && avgPnlPct != null && avgPnlPct > 0) {
      sizeMultiplier = Math.max(sizeMultiplier, 1.05);
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
    accountBuffer,
    withdrawable,
    accountValue,
  };
}
