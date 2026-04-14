import { summarizeBurnInState } from "./burn-in.js";
import { getNormalizedAccountState } from "./account-state.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { buildCompoundingContext } from "./compounding.js";

export function buildBurnInChecklist({ burnIn = null, goLive = null } = {}) {
  const state = burnIn || summarizeBurnInState();
  const live = goLive || null;

  const checklist = [
    { key: "paper_cycles", label: "Paper cycles completed", pass: state.stage === "paper" ? state.cycles >= 10 : state.paperCycles >= 10 },
    { key: "approval_cycles", label: "Approval cycles reviewed", pass: state.stage === "approval" ? state.approvalsReviewed >= 5 : state.approvalCycles >= 5 },
    { key: "no_severe_incidents", label: "No severe incidents", pass: state.severeIncidents === 0 },
    { key: "low_drift", label: "Drift controlled", pass: state.driftEvents <= 1 },
    { key: "low_errors", label: "No execution errors", pass: state.errorEvents === 0 },
    { key: "stream_stable", label: "Stream reconnects/failures acceptable", pass: (state.streamFailures || 0) === 0 },
    { key: "tiny_ready", label: "Go-live check allows tiny autonomous", pass: live ? live.okForTinyAutonomous : false },
  ];

  return {
    stage: state.stage,
    checklist,
    passed: checklist.filter((item) => item.pass).length,
    total: checklist.length,
  };
}

export async function buildBurnInProtocolSummary() {
  const burnIn = summarizeBurnInState();
  const account = await getNormalizedAccountState().catch(() => null);
  const reliability = buildExecutionReliabilitySummary(300);
  const compounding = buildCompoundingContext({ limit: 300, account });
  const lightweightGoLive = {
    okForTinyAutonomous: Boolean(
      account?.user
      && (account?.withdrawable != null ? Number(account.withdrawable) : 0) >= 100
      && compounding.compoundingBias !== "capital_preservation"
      && !reliability.worstSymbols.some((row) => row.reliabilityScore < -0.5)
      && burnIn.promotionReady
    ),
  };
  const checklist = buildBurnInChecklist({ burnIn, goLive: lightweightGoLive });

  return {
    burnIn,
    lightweightGoLive,
    checklist,
    nextStageRecommendation: !checklist.checklist.find((item) => !item.pass)
      ? (burnIn.stage === "paper" ? "approval" : burnIn.stage === "approval" ? "autonomous_tiny" : "continue_supervised")
      : burnIn.stage,
  };
}
