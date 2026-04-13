import { getTradeById, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { cancelRestingOrder, escalateRestingEntry } from "./order-management.js";
import { recordExecutionIncident } from "./execution-incidents.js";

export async function evaluateRestingOrderEscalation(tradeId, { staleMs = Number(process.env.HELIX_RESTING_ORDER_STALE_MS || (15 * 60 * 1000)), autoAct = false } = {}) {
  const trade = getTradeById(tradeId);
  if (!trade) return { tradeId, found: false, escalate: false, reason: "trade_not_found" };

  const state = trade.executionState || {};
  const placedAt = state.restingOrderPlacedAt ? new Date(state.restingOrderPlacedAt).getTime() : null;
  const ageMs = placedAt ? (Date.now() - placedAt) : null;
  const hasOpenOrder = state.hasOpenOrder === true || state.restingOrderActive === true;
  const partialFill = Number(state.exchangeTotalFilledSize || 0) > 0;

  let action = "hold";
  let reason = "resting_order_recent";

  if (!hasOpenOrder) {
    action = partialFill ? "follow_partial_fill" : "none";
    reason = partialFill ? "resting_order_partially_filled_without_open_order" : "no_active_resting_order";
  } else if (partialFill && !hasOpenOrder) {
    action = "follow_partial_fill";
    reason = "partial_fill_present_without_open_order";
  } else if (ageMs != null && ageMs >= staleMs) {
    action = partialFill ? "follow_partial_fill" : "escalate_entry";
    reason = partialFill ? "stale_partial_fill_needs_follow_up" : "stale_resting_entry_needs_escalation";
  }

  const result = {
    tradeId,
    symbol: trade.symbol,
    found: true,
    hasOpenOrder,
    partialFill,
    ageMs,
    action,
    reason,
    escalate: action === "escalate_entry" || action === "follow_partial_fill",
  };

  if (result.escalate) {
    updateTradeExecutionState(tradeId, {
      restingOrderEscalationNeeded: true,
      restingOrderEscalationAction: action,
      restingOrderEscalationReason: reason,
      restingOrderEscalationAt: new Date().toISOString(),
    });
    updateTradeLifecycle(tradeId, {
      lastExchangeState: action === "follow_partial_fill" ? "partial_follow_up_needed" : "resting_escalation_needed",
    });
    recordExecutionIncident({ kind: action === "follow_partial_fill" ? "resting_order_partial_follow_up_needed" : "resting_order_escalation_needed", ...result });

    if (autoAct) {
      result.actionResult = action === "escalate_entry"
        ? await escalateRestingEntry({ tradeId })
        : await cancelRestingOrder({ tradeId });
    }
  }

  return result;
}
