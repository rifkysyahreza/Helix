import { createInfoClient } from "./hyperliquid-client.js";
import { listRecentTrades, updateTradeExchange, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { fetchOrderStatus, fetchHistoricalOrders } from "./tools/hyperliquid.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { deriveExchangePhase } from "./execution-state-machine.js";

function deriveExecutionSnapshot({ order = null, tradeFills = [], historical = null, status = null }) {
  const fillCount = Array.isArray(tradeFills) ? tradeFills.length : 0;
  const totalFilledSize = Array.isArray(tradeFills)
    ? tradeFills.reduce((sum, fill) => sum + Math.abs(Number(fill?.sz || fill?.closedPnl || 0) ? Number(fill?.sz || 0) : 0), 0)
    : 0;

  const historicalStatus = historical?.status || historical?.order?.status || null;
  const statusText = JSON.stringify(status || historical || order || {}).toLowerCase();

  let exchangeState = "unknown";
  if (order) exchangeState = "open";
  else if (fillCount > 0 && statusText.includes("filled")) exchangeState = "filled";
  else if (fillCount > 0) exchangeState = "partially_filled";
  else if (statusText.includes("cancel")) exchangeState = "cancelled";
  else if (historicalStatus) exchangeState = String(historicalStatus).toLowerCase();

  return {
    exchangeState,
    fillCount,
    totalFilledSize: Number(totalFilledSize.toFixed(8)),
    hasOpenOrder: Boolean(order),
    historicalStatus,
    lastOrderStatusAt: new Date().toISOString(),
  };
}

export async function syncTradesWithExchange(limit = 50) {
  const user = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  if (!user) {
    return { synced: 0, skipped: true, reason: "missing_account_address" };
  }

  const info = createInfoClient();
  const [openOrders, fills, historicalOrders, clearinghouseState] = await Promise.all([
    info.openOrders({ user }).catch(() => []),
    info.userFills({ user }).catch(() => []),
    fetchHistoricalOrders(user).catch(() => []),
    info.clearinghouseState({ user }).catch(() => null),
  ]);

  const trades = listRecentTrades(limit);
  let synced = 0;

  for (const trade of trades) {
    const oid = trade.exchange?.oid;
    if (!oid) continue;

    const order = Array.isArray(openOrders)
      ? openOrders.find((item) => item.oid === oid)
      : null;

    const tradeFills = Array.isArray(fills)
      ? fills.filter((fill) => fill.oid === oid)
      : [];

    const historical = Array.isArray(historicalOrders)
      ? historicalOrders.find((item) => item?.order?.oid === oid)
      : null;

    const status = await fetchOrderStatus(user, oid).catch(() => null);

    updateTradeExchange(trade.tradeId, {
      openOrder: order || null,
      fills: tradeFills,
      historicalOrder: historical,
      orderStatus: status,
      lastSyncedAt: new Date().toISOString(),
    });

    const executionSnapshot = deriveExecutionSnapshot({ order, tradeFills, historical, status });
    updateTradeExecutionState(trade.tradeId, {
      exchangeState: executionSnapshot.exchangeState,
      exchangeFillCount: executionSnapshot.fillCount,
      exchangeTotalFilledSize: executionSnapshot.totalFilledSize,
      hasOpenOrder: executionSnapshot.hasOpenOrder,
      lastOrderStatusAt: executionSnapshot.lastOrderStatusAt,
      historicalStatus: executionSnapshot.historicalStatus,
      restingOrderActive: executionSnapshot.hasOpenOrder,
      restingOrderStale: executionSnapshot.hasOpenOrder ? (trade.executionState?.restingOrderStale || false) : false,
    });

    const nextLifecyclePhase = deriveExchangePhase({
      exchangeState: executionSnapshot.exchangeState,
      tradeStatus: trade.status,
      hasOpenOrder: executionSnapshot.hasOpenOrder,
      remainingCloseSize: trade.executionState?.remainingCloseSize,
      remainingReduceSize: trade.executionState?.remainingReduceSize,
      lastIntentAction: trade.executionState?.lastIntentAction || null,
    });

    if (trade.status === "open" && ["filled", "partially_filled", "cancelled"].includes(executionSnapshot.exchangeState) && !executionSnapshot.hasOpenOrder) {
      updateTradeLifecycle(trade.tradeId, {
        lastExchangeState: executionSnapshot.exchangeState,
        lifecyclePhase: nextLifecyclePhase,
      });
      recordExecutionIncident({ kind: "sync_exchange_terminal_state", tradeId: trade.tradeId, symbol: trade.symbol, exchangeState: executionSnapshot.exchangeState, lifecyclePhase: nextLifecyclePhase });
    } else if (nextLifecyclePhase !== "unknown") {
      updateTradeLifecycle(trade.tradeId, {
        lastExchangeState: executionSnapshot.exchangeState,
        lifecyclePhase: nextLifecyclePhase,
      });
    }

    synced += 1;
  }

  return {
    synced,
    openOrdersCount: Array.isArray(openOrders) ? openOrders.length : 0,
    fillsCount: Array.isArray(fills) ? fills.length : 0,
    historicalOrdersCount: Array.isArray(historicalOrders) ? historicalOrders.length : 0,
    hasClearinghouseState: Boolean(clearinghouseState),
  };
}
