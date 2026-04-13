import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import { updateMarketStreamSnapshot, getMarketStreamSnapshot } from "./market-stream-state.js";
import { appendMicrostructureSample } from "./microstructure-state.js";

let subscriptionClient = null;
let subscribedSymbols = new Set();

function ensureClient() {
  if (!subscriptionClient) {
    const transport = new WebSocketTransport();
    subscriptionClient = new SubscriptionClient({ transport });
  }
  return subscriptionClient;
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

  const client = ensureClient();
  await client.l2Book({ coin: upper }, (data) => {
    const metrics = buildBookMetrics(data);
    updateMarketStreamSnapshot(upper, {
      source: "subscription:l2Book",
      levels: data?.levels || null,
      ...metrics,
    });
    appendMicrostructureSample(upper, metrics);
  });

  subscribedSymbols.add(upper);
  return { subscribed: true, symbol: upper, snapshot: getMarketStreamSnapshot(upper) };
}

export function listSubscribedSymbols() {
  return Array.from(subscribedSymbols);
}
