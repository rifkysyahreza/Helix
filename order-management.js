import { createExchangeClient } from "./hyperliquid-client.js";
import { getTradeById, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { openPerpPosition } from "./execution.js";

function mode() {
  return process.env.HELIX_EXECUTION_MODE || (process.env.HELIX_ENABLE_LIVE_EXECUTION === "true" ? "autonomous" : (process.env.DRY_RUN === "true" ? "dry-run" : "paper"));
}

export async function cancelRestingOrder({ tradeId }) {
  const trade = getTradeById(tradeId);
  if (!trade) return { cancelled: false, error: "trade_not_found" };

  const oid = trade.executionState?.restingOrderOid || trade.exchange?.oid || null;
  const asset = trade.snapshot?.assetIndex;
  if (oid == null || asset == null) {
    return { cancelled: false, error: "missing_resting_order_identity", tradeId, oid, asset };
  }

  if (mode() !== "autonomous") {
    updateTradeExecutionState(tradeId, {
      cancelRequested: true,
      cancelRequestedAt: new Date().toISOString(),
    });
    recordExecutionIncident({ kind: "resting_order_cancel_requested_non_live", tradeId, oid, asset, mode: mode() });
    return {
      cancelled: false,
      requiresLiveMode: true,
      tradeId,
      oid,
      asset,
      mode: mode(),
    };
  }

  const exchange = createExchangeClient();
  const result = await exchange.cancel({
    cancels: [{ a: Number(asset), o: Number(oid) }],
  }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

  updateTradeExecutionState(tradeId, {
    restingOrderActive: false,
    cancelRequested: false,
    cancelledRestingOrderAt: new Date().toISOString(),
    cancelResult: result,
  });
  updateTradeLifecycle(tradeId, {
    lastExchangeState: "cancel_requested",
  });
  recordExecutionIncident({ kind: "resting_order_cancel_submitted", tradeId, oid, asset, resultPreview: result?.response?.data?.statuses || null });

  return { cancelled: true, tradeId, oid, asset, result };
}

export async function escalateRestingEntry({ tradeId }) {
  const trade = getTradeById(tradeId);
  if (!trade) return { escalated: false, error: "trade_not_found" };

  const cancel = await cancelRestingOrder({ tradeId });
  if (cancel.error) return { escalated: false, cancel };

  const remainingSize = trade.executionState?.remainingOpenSize ?? trade.sizeUsd;
  const executionTactics = {
    ...(trade.executionState?.executionTactics || {}),
    orderStyle: "ioc_limit",
    urgency: "high",
    aggressionBps: 30,
  };

  updateTradeExecutionState(tradeId, {
    escalationTriggeredAt: new Date().toISOString(),
    escalationMode: "passive_to_aggressive_reentry",
  });
  updateTradeLifecycle(tradeId, {
    lastExchangeState: "escalation_reentry_pending",
  });

  const reentry = await openPerpPosition({
    symbol: trade.symbol,
    side: trade.side,
    sizeUsd: remainingSize,
    leverage: 1,
    asset: trade.snapshot?.assetIndex,
    price: trade.snapshot?.markPx || trade.snapshot?.midPx || 1,
    size: remainingSize,
    executionTactics,
  });

  recordExecutionIncident({ kind: "resting_order_escalation_reentry", tradeId, remainingSize, reentryMode: reentry?.context?.mode || null });
  return {
    escalated: true,
    tradeId,
    cancel,
    reentry,
  };
}
