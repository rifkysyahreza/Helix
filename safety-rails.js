import { listRecentTrades } from "./state.js";

export function evaluateAutonomousSafety({ account = null, symbol = null, executionReliability = null }) {
  const recentTrades = listRecentTrades(100);
  const recentClosed = recentTrades.filter((trade) => trade.status === "closed").slice(0, 10);
  const recentAvgPnl = recentClosed.length
    ? recentClosed.reduce((sum, trade) => sum + Number(trade.realizedPnlPct || 0), 0) / recentClosed.length
    : null;

  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  const accountValue = account?.marginSummary?.accountValue != null ? Number(account.marginSummary.accountValue) : null;
  const capitalBase = withdrawable ?? accountValue ?? null;

  let allowAutonomous = true;
  const reasons = [];

  if (capitalBase != null && capitalBase < 100) {
    allowAutonomous = false;
    reasons.push("capital_buffer_too_thin");
  }

  if (recentAvgPnl != null && recentAvgPnl <= -3) {
    allowAutonomous = false;
    reasons.push("recent_pnl_drawdown");
  }

  if (executionReliability && executionReliability.total >= 3 && executionReliability.reliabilityScore < -0.25) {
    allowAutonomous = false;
    reasons.push("execution_reliability_too_weak");
  }

  return {
    symbol,
    allowAutonomous,
    reasons,
    recentAvgPnl,
    capitalBase,
    executionReliability,
  };
}
