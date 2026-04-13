import { getTradeById, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";

export function evaluatePartialFillFollowUp(tradeId) {
  const trade = getTradeById(tradeId);
  if (!trade) return { tradeId, found: false, action: "none", reason: "trade_not_found" };

  const state = trade.executionState || {};
  const filled = Number(state.exchangeTotalFilledSize || 0);
  const requested = Number(state.lastRequestedOpenSize || state.remainingOpenSize || trade.sizeUsd || 0);
  const remaining = state.remainingOpenSize != null
    ? Number(state.remainingOpenSize)
    : Math.max(0, requested - filled);
  const ratio = requested > 0 ? filled / requested : 0;
  const style = state.executionTactics?.orderStyle || null;

  let action = "hold_partial";
  let reason = "partial_fill_present";

  if (filled <= 0) {
    action = "none";
    reason = "no_partial_fill";
  } else if (remaining <= 0) {
    action = "filled_complete";
    reason = "no_remaining_size";
  } else if (style === "resting_limit_preferred" || style === "small_probe_limit") {
    action = ratio >= 0.5 ? "complete_aggressively" : "cancel_remainder";
    reason = ratio >= 0.5 ? "majority_filled_complete_entry" : "minor_fill_cancel_remainder";
  } else {
    action = ratio >= 0.33 ? "complete_aggressively" : "hold_partial";
    reason = ratio >= 0.33 ? "meaningful_partial_fill" : "small_partial_wait";
  }

  const result = {
    tradeId,
    symbol: trade.symbol,
    found: true,
    filled,
    requested,
    remaining,
    ratio: Number(ratio.toFixed(4)),
    action,
    reason,
  };

  if (action !== "none" && action !== "filled_complete") {
    updateTradeExecutionState(tradeId, {
      partialFillFollowUpNeeded: true,
      partialFillFollowUpAction: action,
      partialFillFollowUpReason: reason,
      partialFillFollowUpAt: new Date().toISOString(),
    });
    updateTradeLifecycle(tradeId, {
      lastExchangeState: "partial_fill_follow_up_needed",
    });
    recordExecutionIncident({ kind: "partial_fill_follow_up_needed", ...result });
  }

  return result;
}
