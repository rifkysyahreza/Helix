function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function analyzeOrderBook(book = null) {
  const bids = book?.levels?.[0] || [];
  const asks = book?.levels?.[1] || [];
  if (!bids.length || !asks.length) {
    return { spreadPct: null, imbalance: null, depthBias: "unknown", reason: "missing_book_levels" };
  }

  const bestBid = toNumber(bids[0].px ?? bids[0].price);
  const bestAsk = toNumber(asks[0].px ?? asks[0].price);
  const bestBidSz = toNumber(bids[0].sz ?? bids[0].size) || 0;
  const bestAskSz = toNumber(asks[0].sz ?? asks[0].size) || 0;

  const spreadPct = bestBid && bestAsk ? Number((((bestAsk - bestBid) / bestBid) * 100).toFixed(4)) : null;
  const bidDepth = bids.slice(0, 5).reduce((sum, level) => sum + (toNumber(level.sz ?? level.size) || 0), 0);
  const askDepth = asks.slice(0, 5).reduce((sum, level) => sum + (toNumber(level.sz ?? level.size) || 0), 0);
  const imbalance = (bidDepth + askDepth) > 0 ? Number(((bidDepth - askDepth) / (bidDepth + askDepth)).toFixed(4)) : 0;

  let depthBias = "balanced";
  if (imbalance > 0.15) depthBias = "bid_support";
  else if (imbalance < -0.15) depthBias = "ask_pressure";

  let executionQuality = "normal";
  if (spreadPct != null && spreadPct > 0.08) executionQuality = "poor";
  else if (spreadPct != null && spreadPct < 0.03 && Math.abs(imbalance) < 0.35) executionQuality = "good";

  return {
    bestBid,
    bestAsk,
    bestBidSz,
    bestAskSz,
    spreadPct,
    bidDepth,
    askDepth,
    imbalance,
    depthBias,
    executionQuality,
    reason: "derived_from_top_5_l2_levels",
  };
}
