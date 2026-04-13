import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import { updateMarketStreamSnapshot, getMarketStreamSnapshot } from "./market-stream-state.js";
import { appendMicrostructureSample } from "./microstructure-state.js";
import { appendTrades } from "./trade-stream-state.js";
import { markStreamSubscription, markStreamFailure, markStreamReconnect, getStreamRuntimeState } from "./stream-runtime-state.js";

let subscriptionClient = null;
let subscribedSymbols = new Set();
let tradeSubscribedSymbols = new Set();

function ensureClient(forceReset = false) {
  if (!subscriptionClient || forceReset) {
    const transport = new WebSocketTransport();
    subscriptionClient = new SubscriptionClient({ transport });
  }
  return subscriptionClient;
}

async function subscribeWithRecovery({ symbol, kind, subscribe }) {
  try {
    const result = await subscribe(ensureClient());
    markStreamSubscription(symbol, kind);
    return result;
  } catch (error) {
    markStreamFailure(symbol, kind, error);
    const retriedClient = ensureClient(true);
    const retried = await subscribe(retriedClient);
    markStreamReconnect(symbol, kind);
    return retried;
  }
}

function buildBookMetrics(data) {
  const bids = data?.levels?.[0] || [];
  const asks = data?.levels?.[1] || [];
  const bestBid = Number(bids[0]?.px || bids[0]?.price || 0) || null;
  const bestAsk = Number(asks[0]?.px || asks[0]?.price || 0) || null;
  const bidDepth = bids.slice(0, 5).reduce((sum, level) => sum + Number(level?.sz || level?.size || 0), 0);
  const askDepth = asks.slice(0, 5).reduce((sum, level) => sum + Number(level?.sz || level?.size || 0), 0);
  const imbalance = (bidDepth + askDepth) > 0 ? Number(((bidDepth - askDepth) / (bidDepth + askDepth)).toFixed(4)) : 0;
  const spreadPct = bestBid && bestAsk ? Number((((bestAsk - bestBid) / bestBid) * 100).toFixed(4)) : null;
  return { bestBid, bestAsk, bidDepth, askDepth, imbalance, spreadPct };
}

export async function subscribeSymbolOrderBook(symbol) {
  const upper = String(symbol || "").toUpperCase();
  if (!upper) return { subscribed: false, error: "symbol is required" };
  if (subscribedSymbols.has(upper)) {
    return { subscribed: true, symbol: upper, existing: true, snapshot: getMarketStreamSnapshot(upper) };
  }

  await subscribeWithRecovery({
    symbol: upper,
    kind: "orderBook",
    subscribe: (client) => client.l2Book({ coin: upper }, (data) => {
      const metrics = buildBookMetrics(data);
      updateMarketStreamSnapshot(upper, {
        source: "subscription:l2Book",
        levels: data?.levels || null,
        ...metrics,
      });
      appendMicrostructureSample(upper, metrics);
    }),
  });

  subscribedSymbols.add(upper);
  return { subscribed: true, symbol: upper, snapshot: getMarketStreamSnapshot(upper) };
}

export async function subscribeSymbolTrades(symbol) {
  const upper = String(symbol || "").toUpperCase();
  if (!upper) return { subscribed: false, error: "symbol is required" };
  if (tradeSubscribedSymbols.has(upper)) {
    return { subscribed: true, symbol: upper, existing: true };
  }

  await subscribeWithRecovery({
    symbol: upper,
    kind: "trades",
    subscribe: (client) => client.trades({ coin: upper }, (data) => {
      appendTrades(upper, data || []);
    }),
  });

  tradeSubscribedSymbols.add(upper);
  return { subscribed: true, symbol: upper };
}

export function listSubscribedSymbols() {
  return {
    orderBooks: Array.from(subscribedSymbols),
    trades: Array.from(tradeSubscribedSymbols),
  };
}

export function getStreamSubscriptionsRuntime() {
  return getStreamRuntimeState();
}
