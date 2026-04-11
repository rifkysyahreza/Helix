import { createInfoClient } from "./hyperliquid-client.js";
import { listRecentTrades, updateTradeExchange } from "./state.js";
import { fetchOrderStatus, fetchHistoricalOrders } from "./tools/hyperliquid.js";

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
