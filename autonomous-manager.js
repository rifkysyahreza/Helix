import { getNormalizedAccountState } from "./account-state.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { evaluateAutonomousSafety } from "./safety-rails.js";
import { reconcileExecutionLeftovers } from "./reconciliation.js";
import { escalateRestingEntry, cancelRestingOrder } from "./order-management.js";
import { recordExecutionIncident } from "./execution-incidents.js";

export async function runAutonomousManagementPass({ autoAct = true } = {}) {
  const account = await getNormalizedAccountState().catch(() => null);
  const reliability = buildExecutionReliabilitySummary(200);
  const safety = evaluateAutonomousSafety({ account, executionReliability: reliability });
  const reconciliation = await reconcileExecutionLeftovers(200).catch((error) => ({ error: error.message, restingFollowUps: [] }));

  const actions = [];
  const followUps = reconciliation?.restingFollowUps || [];

  for (const followUp of followUps) {
    if (!followUp?.tradeId) continue;

    if (!autoAct) {
      actions.push({ tradeId: followUp.tradeId, action: followUp.action, deferred: true });
      continue;
    }

    if (!safety.allowAutonomous && followUp.action === "escalate_entry") {
      const cancelOnly = await cancelRestingOrder({ tradeId: followUp.tradeId });
      actions.push({ tradeId: followUp.tradeId, action: "cancel_only_due_to_safety", result: cancelOnly });
      recordExecutionIncident({ kind: "autonomous_manager_cancel_only_due_to_safety", tradeId: followUp.tradeId, reasons: safety.reasons });
      continue;
    }

    if (followUp.action === "escalate_entry") {
      const result = await escalateRestingEntry({ tradeId: followUp.tradeId });
      actions.push({ tradeId: followUp.tradeId, action: followUp.action, result });
      continue;
    }

    if (followUp.action === "follow_partial_fill") {
      const result = await cancelRestingOrder({ tradeId: followUp.tradeId });
      actions.push({ tradeId: followUp.tradeId, action: followUp.action, result });
      recordExecutionIncident({ kind: "autonomous_manager_partial_fill_follow_up", tradeId: followUp.tradeId });
    }
  }

  return {
    safety,
    reconciliation,
    actions,
  };
}
