import { getNormalizedAccountState } from "./account-state.js";
import { buildExecutionReliabilitySummary } from "./execution-reliability.js";
import { evaluateAutonomousSafety } from "./safety-rails.js";
import { reconcileExecutionLeftovers } from "./reconciliation.js";
import { escalateRestingEntry, cancelRestingOrder } from "./order-management.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { evaluatePartialFillFollowUp } from "./partial-fill-policy.js";
import { listRecentTrades } from "./state.js";
import { evaluateOpenPositions } from "./position-management-policy.js";
import { reducePerpPosition, closePerpPosition } from "./execution.js";
import { buildSymbolAnalysis } from "./tools/executor.js";

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
      const partialPlan = evaluatePartialFillFollowUp(followUp.tradeId);
      let result = null;

      if (partialPlan.action === "complete_aggressively") {
        result = await escalateRestingEntry({ tradeId: followUp.tradeId });
      } else if (partialPlan.action === "cancel_remainder") {
        result = await cancelRestingOrder({ tradeId: followUp.tradeId });
      } else {
        result = { held: true, partialPlan };
      }

      actions.push({ tradeId: followUp.tradeId, action: followUp.action, partialPlan, result });
      recordExecutionIncident({ kind: "autonomous_manager_partial_fill_follow_up", tradeId: followUp.tradeId, partialAction: partialPlan.action });
    }
  }

  const openTrades = listRecentTrades(200).filter((trade) => trade.status === "open");
  const analysisEntries = await Promise.all(openTrades.map(async (trade) => {
    try {
      return [trade.symbol, await buildSymbolAnalysis(trade.symbol)];
    } catch {
      return [trade.symbol, null];
    }
  }));
  const analysesBySymbol = Object.fromEntries(analysisEntries);
  const positionDecisions = evaluateOpenPositions({ trades: openTrades, positions: account?.positions || [], analysesBySymbol });

  for (const decision of positionDecisions) {
    if (!autoAct || !safety.allowAutonomous) {
      actions.push({ tradeId: decision.tradeId, action: decision.action, deferred: true, reason: decision.reason });
      continue;
    }

    const trade = openTrades.find((item) => item.tradeId === decision.tradeId);
    const livePosition = (account?.positions || []).find((position) => position.coin === trade?.symbol) || null;
    if (!trade || !livePosition) continue;

    if (decision.action === "protect") {
      actions.push({ tradeId: decision.tradeId, action: decision.action, reason: decision.reason, protection: decision.profitProtection || null });
      recordExecutionIncident({ kind: "autonomous_manager_profit_protection", tradeId: decision.tradeId, reason: decision.reason });
    } else if (decision.action === "reduce" && decision.reducePct > 0) {
      const result = await reducePerpPosition({
        symbol: trade.symbol,
        side: trade.side,
        reducePct: decision.reducePct,
        size: Math.abs(Number(livePosition.szi || 0)) * (decision.reducePct / 100),
        livePosition,
        executionTactics: trade.executionState?.executionTactics || null,
      });
      actions.push({ tradeId: decision.tradeId, action: decision.action, reducePct: decision.reducePct, reason: decision.reason, result });
      recordExecutionIncident({ kind: "autonomous_manager_position_reduce", tradeId: decision.tradeId, reducePct: decision.reducePct, reason: decision.reason });
    } else if (decision.action === "close") {
      const result = await closePerpPosition({ trade, livePosition, executionTactics: trade.executionState?.executionTactics || null });
      actions.push({ tradeId: decision.tradeId, action: decision.action, reason: decision.reason, result });
      recordExecutionIncident({ kind: "autonomous_manager_position_close", tradeId: decision.tradeId, reason: decision.reason });
    }
  }

  return {
    safety,
    reconciliation,
    positionDecisions,
    actions,
  };
}
