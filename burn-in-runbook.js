import { buildBurnInProtocolSummary } from "./burn-in-protocol.js";
import { buildHealthSummary } from "./health-summary.js";

export async function buildBurnInRunbookStatus() {
  const protocol = await buildBurnInProtocolSummary().catch(() => null);
  const health = await buildHealthSummary({ limit: 100 }).catch(() => null);

  const stage = protocol?.burnIn?.stage || "paper";
  const nextStage = protocol?.nextStageRecommendation || stage;
  const blockers = (protocol?.checklist?.checklist || []).filter((item) => !item.pass).map((item) => item.label);

  return {
    stage,
    nextStage,
    blockers,
    recommendedAction: blockers.length ? "hold_or_rollback" : "promote_or_continue",
    protocol,
    health,
  };
}
