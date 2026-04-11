import { createInfoClient } from "../hyperliquid-client.js";

export async function fetchMetaAndAssetContexts() {
  const info = createInfoClient();
  const metaAndAssetCtxs = await info.metaAndAssetCtxs();
  const meta = await info.meta();
  return { meta, metaAndAssetCtxs };
}

export async function fetchAllMids() {
  const info = createInfoClient();
  return await info.allMids();
}

export async function fetchClearingState(user) {
  if (!user) {
    return { missingUser: true, positions: [], marginSummary: null };
  }
  const info = createInfoClient();
  return await info.clearinghouseState({ user });
}

export async function fetchOrderStatus(user, oid) {
  const info = createInfoClient();
  return await info.orderStatus({ user, oid });
}

export async function fetchHistoricalOrders(user) {
  const info = createInfoClient();
  return await info.historicalOrders({ user });
}

export async function fetchCandles(symbol, interval = "15m", lookbackMs = 6 * 60 * 60 * 1000) {
  const info = createInfoClient();
  const endTime = Date.now();
  const startTime = endTime - lookbackMs;
  return await info.candleSnapshot({ coin: symbol, interval, startTime, endTime });
}

export async function fetchFunding(symbol, lookbackMs = 24 * 60 * 60 * 1000) {
  const info = createInfoClient();
  const endTime = Date.now();
  const startTime = endTime - lookbackMs;
  return await info.fundingHistory({ coin: symbol, startTime, endTime });
}

export async function fetchL2Book(symbol) {
  const info = createInfoClient();
  return await info.l2Book({ coin: symbol, nSigFigs: 4 });
}

export function buildSymbolSnapshot(symbol, metaAndAssetCtxs, mids) {
  const universe = metaAndAssetCtxs?.[0]?.universe || [];
  const contexts = metaAndAssetCtxs?.[1] || [];
  const idx = universe.findIndex((asset) => asset.name === symbol);
  if (idx === -1) return null;

  const asset = universe[idx];
  const ctx = contexts[idx] || {};
  const mid = mids?.[symbol] ?? null;

  return {
    symbol,
    assetIndex: idx,
    markPx: ctx.markPx ? Number(ctx.markPx) : null,
    oraclePx: ctx.oraclePx ? Number(ctx.oraclePx) : null,
    midPx: mid ? Number(mid) : null,
    funding: ctx.funding ? Number(ctx.funding) : null,
    openInterest: ctx.openInterest ? Number(ctx.openInterest) : null,
    dayNtlVlm: ctx.dayNtlVlm ? Number(ctx.dayNtlVlm) : null,
    premium: ctx.premium ? Number(ctx.premium) : null,
    impactPxs: ctx.impactPxs || null,
    maxLeverage: asset?.maxLeverage ?? null,
    szDecimals: asset?.szDecimals ?? null,
    onlyIsolated: asset?.onlyIsolated ?? false,
  };
}
