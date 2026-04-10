const API_URL = process.env.HYPERLIQUID_API_URL || "https://api.hyperliquid.xyz/info";

async function postInfo(body) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid API error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

export async function fetchMetaAndAssetContexts() {
  const [meta, assetContexts] = await Promise.all([
    postInfo({ type: "meta" }),
    postInfo({ type: "metaAndAssetCtxs" }),
  ]);
  return { meta, assetContexts };
}

export async function fetchAllMids() {
  return await postInfo({ type: "allMids" });
}

export async function fetchClearingState(user) {
  if (!user) {
    return { missingUser: true, positions: [], marginSummary: null };
  }
  return await postInfo({ type: "clearinghouseState", user });
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
