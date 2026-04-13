import { listRecentTrades, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";

const DEFAULT_STALE_MS = Number(process.env.HELIX_RESTING_ORDER_STALE_MS || (15 * 60 * 1000));

export function markRestingOrderPlaced(tradeId, { orderStyle = null, tif = null, oid = null, placedAt = null } = {}) {
  const now = placedAt || new Date().toISOString();
  updateTradeExecutionState(tradeId, {
    restingOrderActive: true,
    restingOrderStyle: orderStyle,
    restingOrderTif: tif,
    restingOrderOid: oid,
    restingOrderPlacedAt: now,
  });
  updateTradeLifecycle(tradeId, {
    lifecyclePhase: "open_resting",
    lastExchangeState: "resting",
  });
  recordExecutionIncident({ kind: "resting_order_placed", tradeId, orderStyle, tif, oid, placedAt: now });
}

export function scanStaleRestingOrders(limit = 200, staleMs = DEFAULT_STALE_MS) {
  const trades = listRecentTrades(limit);
  const now = Date.now();
  const stale = [];

  for (const trade of trades) {
    const placedAt = trade.executionState?.restingOrderPlacedAt;
    const active = trade.executionState?.restingOrderActive;
    if (!active || !placedAt) continue;

    const ageMs = now - new Date(placedAt).getTime();
    if (ageMs < staleMs) continue;

    updateTradeExecutionState(trade.tradeId, {
      restingOrderStale: true,
      restingOrderAgeMs: ageMs,
    });
    updateTradeLifecycle(trade.tradeId, {
      lastExchangeState: "resting_stale",
    });

    const item = { tradeId: trade.tradeId, symbol: trade.symbol, ageMs, orderStyle: trade.executionState?.restingOrderStyle || null };
    stale.push(item);
    recordExecutionIncident({ kind: "resting_order_stale", ...item });
  }

  return { stale, staleThresholdMs: staleMs };
}
