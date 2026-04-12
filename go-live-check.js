import { getNormalizedAccountState } from "./account-state.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { buildCompoundingContext } from "./compounding.js";
import { summarizeBurnInState } from "./burn-in.js";

export async function buildGoLiveCheck() {
  const account = await getNormalizedAccountState().catch(() => null);
  const reliability = buildExecutionReliabilitySummary(300);
  const compounding = buildCompoundingContext({ limit: 300, account });
  const burnIn = summarizeBurnInState();

  const issues = [];

  if (!account?.user) issues.push("missing_account_state");
  if ((account?.withdrawable != null ? Number(account.withdrawable) : 0) < 100) issues.push("low_withdrawable_buffer");
  if (compounding.compoundingBias === "capital_preservation") issues.push("capital_preservation_mode_active");
  if (reliability.worstSymbols.some((row) => row.reliabilityScore < -0.5)) issues.push("execution_reliability_too_weak");
  if (!burnIn.promotionReady) issues.push("burn_in_not_ready");

  return {
    okForTinyAutonomous: issues.length === 0,
    issues,
    account,
    reliability,
    compounding,
    burnIn,
    recommendedMode: issues.length === 0 ? "autonomous-tiny" : "approval",
  };
}
