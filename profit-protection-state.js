import { getTradeById, updateTradeExecutionState } from "./state.js";

export function evaluateProfitProtection(tradeId, { livePosition = null, analysis = null } = {}) {
  const trade = getTradeById(tradeId);
  if (!trade || !livePosition) return { tradeId, action: "none", reason: "missing_trade_or_position" };

  const roe = Number(livePosition.returnOnEquity || 0);
  const side = trade.side === "short" ? "short" : "long";
  const flowBias = analysis?.orderFlowSignals?.directionalBias || analysis?.tradeFlow?.bias || "neutral";
  const state = trade.executionState || {};

  let protectionState = state.profitProtectionState || "none";
  let action = "hold";
  let reason = "no_profit_protection_change";

  if (roe >= 5 && protectionState === "none") {
    protectionState = "break_even_armed";
    action = "raise_stop";
    reason = "arm_break_even";
  }
  if (roe >= 10 && ["none", "break_even_armed"].includes(protectionState)) {
    protectionState = "profit_locked";
    action = "raise_stop";
    reason = "lock_profit";
  }
  if (protectionState === "profit_locked" && flowBias !== "neutral" && flowBias !== side) {
    action = "reduce";
    reason = "locked_profit_flow_reversal";
  }

  updateTradeExecutionState(tradeId, {
    profitProtectionState: protectionState,
    profitProtectionReason: reason,
    profitProtectionUpdatedAt: new Date().toISOString(),
  });

  return { tradeId, action, reason, protectionState, roe };
}
