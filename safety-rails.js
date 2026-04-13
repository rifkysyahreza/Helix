import { listRecentTrades } from "./state.js";
import { buildPortfolioRiskProfile } from "./portfolio-risk.js";
import { buildAutonomySessionState } from "./autonomy-session-state.js";

export function evaluateAutonomousSafety({ account = null, symbol = null, executionReliability = null }) {
  const recentTrades = listRecentTrades(100);
  const recentClosed = recentTrades.filter((trade) => trade.status === "closed").slice(0, 10);
  const recentAvgPnl = recentClosed.length
    ? recentClosed.reduce((sum, trade) => sum + Number(trade.realizedPnlPct || 0), 0) / recentClosed.length
    : null;

  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  const accountValue = account?.marginSummary?.accountValue != null ? Number(account.marginSummary.accountValue) : null;
  const capitalBase = withdrawable ?? accountValue ?? null;

  const portfolio = buildPortfolioRiskProfile({ account });
  const session = buildAutonomySessionState();

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

  if (executionReliability && executionReliability.ioc_cancel >= 2) {
    allowAutonomous = false;
    reasons.push("ioc_cancel_streak");
  }

  if (executionReliability && executionReliability.error >= 2) {
    allowAutonomous = false;
    reasons.push("execution_error_streak");
  }

  if (portfolio.autonomyLevel === "degraded") {
    reasons.push(...portfolio.reasons);
  }
  if (portfolio.autonomyLevel === "halt_new_entries") {
    allowAutonomous = false;
    reasons.push(...portfolio.reasons);
  }

  if (session.sessionDegraded) {
    reasons.push(...session.reasons);
  }
  if (session.dailyLockout) {
    allowAutonomous = false;
  }

  return {
    symbol,
    allowAutonomous,
    reasons: Array.from(new Set(reasons)),
    recentAvgPnl,
    capitalBase,
    executionReliability,
    portfolio,
    session,
  };
}
