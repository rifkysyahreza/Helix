export function buildRiskBudget({ account = null, proposedSizeUsd = null }) {
  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  const accountValue = account?.marginSummary?.accountValue != null ? Number(account.marginSummary.accountValue) : null;
  const marginUsed = account?.marginSummary?.totalMarginUsed != null ? Number(account.marginSummary.totalMarginUsed) : null;

  const capitalBase = withdrawable ?? accountValue ?? null;
  const maxBudgetUsd = capitalBase != null ? capitalBase * 0.1 : null;
  const hardCapUsd = capitalBase != null ? capitalBase * 0.2 : null;
  const utilization = capitalBase && marginUsed != null ? marginUsed / capitalBase : null;

  let cappedSizeUsd = proposedSizeUsd;
  let budgetBias = "normal";
  let note = "Risk budget did not require adjustment.";

  if (cappedSizeUsd != null && maxBudgetUsd != null && cappedSizeUsd > maxBudgetUsd) {
    cappedSizeUsd = maxBudgetUsd;
    budgetBias = "budget_capped";
    note = `Proposed size was capped to ${maxBudgetUsd.toFixed(2)} based on 10% risk budget.`;
  }

  if (cappedSizeUsd != null && hardCapUsd != null && cappedSizeUsd > hardCapUsd) {
    cappedSizeUsd = hardCapUsd;
    budgetBias = "hard_capped";
    note = `Proposed size was hard capped to ${hardCapUsd.toFixed(2)} based on 20% account cap.`;
  }

  if (utilization != null && utilization > 0.5) {
    cappedSizeUsd = cappedSizeUsd != null ? cappedSizeUsd * 0.8 : cappedSizeUsd;
    budgetBias = "margin_constrained";
    note = `Margin utilization is elevated (${(utilization * 100).toFixed(1)}%), so Helix reduced size further.`;
  }

  return {
    capitalBase,
    withdrawable,
    accountValue,
    marginUsed,
    utilization,
    maxBudgetUsd,
    hardCapUsd,
    budgetBias,
    note,
    cappedSizeUsd: cappedSizeUsd != null ? Number(cappedSizeUsd.toFixed(2)) : null,
  };
}
