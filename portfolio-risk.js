import { listRecentTrades } from "./state.js";

function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function buildPortfolioRiskProfile({ account = null } = {}) {
  const recentTrades = listRecentTrades(200);
  const openTrades = recentTrades.filter((trade) => trade.status === "open");
  const closedTrades = recentTrades.filter((trade) => trade.status === "closed").slice(0, 20);
  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  const accountValue = account?.marginSummary?.accountValue != null ? Number(account.marginSummary.accountValue) : null;
  const capitalBase = withdrawable ?? accountValue ?? null;
  const marginUsed = account?.marginSummary?.totalMarginUsed != null ? Number(account.marginSummary.totalMarginUsed) : 0;
  const utilization = capitalBase ? marginUsed / capitalBase : null;
  const consecutiveLosses = (() => {
    let streak = 0;
    for (const trade of closedTrades) {
      const pnl = Number(trade.realizedPnlPct || 0);
      if (pnl < 0) streak += 1;
      else break;
    }
    return streak;
  })();
  const openExposureUsd = openTrades.reduce((sum, trade) => sum + Math.abs(Number(trade.sizeUsd || 0)), 0);
  const symbolCounts = openTrades.reduce((acc, trade) => {
    acc[trade.symbol] = (acc[trade.symbol] || 0) + 1;
    return acc;
  }, {});
  const correlatedExposure = Object.values(symbolCounts).some((count) => count >= 2);

  let autonomyLevel = "normal";
  const reasons = [];

  if (utilization != null && utilization > 0.6) {
    autonomyLevel = "degraded";
    reasons.push("high_margin_utilization");
  }
  if (consecutiveLosses >= 3) {
    autonomyLevel = "degraded";
    reasons.push("loss_streak");
  }
  if (capitalBase != null && openExposureUsd > capitalBase * 0.35) {
    autonomyLevel = "degraded";
    reasons.push("open_exposure_too_high");
  }
  if (correlatedExposure) {
    autonomyLevel = "degraded";
    reasons.push("correlated_symbol_exposure");
  }
  if (consecutiveLosses >= 5 || (utilization != null && utilization > 0.8)) {
    autonomyLevel = "halt_new_entries";
    reasons.push("portfolio_hard_brake");
  }

  return {
    capitalBase,
    utilization: round(utilization, 4),
    openExposureUsd: round(openExposureUsd, 2),
    openTradeCount: openTrades.length,
    consecutiveLosses,
    correlatedExposure,
    autonomyLevel,
    reasons,
  };
}
