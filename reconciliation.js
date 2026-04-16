import { getNormalizedAccountState } from "./account-state.js";
import { listRecentTrades, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { evaluateRestingOrderEscalation } from "./resting-order-policy.js";

function shouldMarkTradeFlat(trade, position, account) {
  if (position) return false;
  if (trade.status !== "open") return false;
  const exchangeState = trade.executionState?.exchangeState;
  const remainingCloseSize = trade.executionState?.remainingCloseSize;
  const remainingReduceSize = trade.executionState?.remainingReduceSize;
  const hasExchangeIdentity = trade.exchange?.oid != null || trade.exchange?.status != null || trade.executionState?.restingOrderOid != null;
  const missingAccountUser = !account?.user;
  const staleSyntheticPending = trade.lifecyclePhase === "open_pending" && !hasExchangeIdentity;

  if (["filled", "partially_filled", "cancelled"].includes(exchangeState)
    && (remainingCloseSize === 0 || remainingCloseSize == null)
    && (remainingReduceSize === 0 || remainingReduceSize == null)) {
    return true;
  }

  if (staleSyntheticPending && missingAccountUser) {
    return true;
  }

  return false;
}

export async function reconcileExecutionLeftovers(limit = 200) {
  const trades = listRecentTrades(limit);
  const account = await getNormalizedAccountState().catch(() => null);
  const positionsByCoin = new Map((account?.positions || []).map((position) => [position.coin, position]));
  const updates = [];
  const drifts = [];
  const lifecycleRepairs = [];

  const restingFollowUps = [];

  for (const trade of trades) {
    const position = positionsByCoin.get(trade.symbol) || null;
    const remainingReduceSize = trade.executionState?.remainingReduceSize;
    const remainingCloseSize = trade.executionState?.remainingCloseSize;

    const patch = {};

    if (remainingReduceSize != null) {
      patch.reconciledRemainingReduceSize = position ? Math.min(Math.abs(Number(position.szi || 0)), remainingReduceSize) : 0;
    }

    if (remainingCloseSize != null) {
      patch.reconciledRemainingCloseSize = position ? Math.abs(Number(position.szi || 0)) : 0;
    }

    if (trade.status === "open" && !position && trade.executionState?.exchangeState && ["filled", "partially_filled", "cancelled"].includes(trade.executionState.exchangeState)) {
      patch.reconciledMissingLivePosition = true;
      const drift = { tradeId: trade.tradeId, symbol: trade.symbol, kind: "open_trade_without_live_position", exchangeState: trade.executionState.exchangeState };
      drifts.push(drift);
      recordExecutionIncident({ kind: "reconciliation_drift_open_without_live_position", ...drift });
    }

    if (trade.status === "closed" && position) {
      patch.reconciledUnexpectedLivePosition = true;
      const drift = { tradeId: trade.tradeId, symbol: trade.symbol, kind: "closed_trade_with_live_position", liveSize: position.szi };
      drifts.push(drift);
      recordExecutionIncident({ kind: "reconciliation_drift_closed_with_live_position", ...drift });
    }

    if (trade.executionState?.restingOrderActive && !position && trade.executionState?.exchangeState === "cancelled") {
      patch.reconciledRestingOrderCancelled = true;
      patch.restingOrderActive = false;
    }

    if (Object.keys(patch).length) {
      updateTradeExecutionState(trade.tradeId, patch);
      updates.push({ tradeId: trade.tradeId, symbol: trade.symbol, patch });
    }

    if (shouldMarkTradeFlat(trade, position, account)) {
      const syntheticPending = trade.lifecyclePhase === "open_pending" && !(trade.exchange?.oid != null || trade.exchange?.status != null || trade.executionState?.restingOrderOid != null) && !account?.user;
      updateTradeLifecycle(trade.tradeId, {
        status: "closed",
        lifecyclePhase: "closed",
        closeReason: trade.closeReason || (syntheticPending ? "reconciled_stale_pending" : "reconciled_flat"),
        closedAt: trade.closedAt || new Date().toISOString(),
        lastExchangeState: syntheticPending ? "reconciled_stale_pending" : "reconciled_flat",
      });
      const repair = { tradeId: trade.tradeId, symbol: trade.symbol, repair: syntheticPending ? "marked_closed_from_stale_pending" : "marked_closed_from_exchange_flat" };
      lifecycleRepairs.push(repair);
      recordExecutionIncident({ kind: "reconciliation_repair_marked_closed", ...repair });
    } else if (trade.status === "closed" && position) {
      updateTradeLifecycle(trade.tradeId, {
        lastExchangeState: "drift_live_position_still_open",
      });
      const repair = { tradeId: trade.tradeId, symbol: trade.symbol, repair: "flagged_closed_trade_with_live_position" };
      lifecycleRepairs.push(repair);
      recordExecutionIncident({ kind: "reconciliation_repair_flagged_live_position_on_closed_trade", ...repair });
    }

    if (trade.status === "open" && trade.executionState?.restingOrderActive) {
      const followUp = await evaluateRestingOrderEscalation(trade.tradeId);
      if (followUp?.escalate) restingFollowUps.push(followUp);
    }
  }

  return {
    account,
    updates,
    drifts,
    lifecycleRepairs,
    restingFollowUps,
  };
}
