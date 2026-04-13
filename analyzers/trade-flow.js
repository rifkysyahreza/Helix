export function analyzeTradeFlow(trades = []) {
  const series = Array.isArray(trades) ? trades.filter(Boolean) : [];
  if (series.length < 3) {
    return { regime: "unknown", buyVolume: 0, sellVolume: 0, delta: 0, deltaBias: "neutral", aggressionBias: "unknown", reason: "not_enough_trades" };
  }

  const recent = series.slice(-100);
  let buyVolume = 0;
  let sellVolume = 0;

  for (const trade of recent) {
    const size = Number(trade.sz || trade.size || 0);
    const side = String(trade.side || trade.dir || trade.aggressor || "").toLowerCase();
    if (side.includes("buy") || side === "b") buyVolume += size;
    else if (side.includes("sell") || side === "a" || side === "s") sellVolume += size;
  }

  const delta = Number((buyVolume - sellVolume).toFixed(4));
  const total = buyVolume + sellVolume;
  const imbalance = total > 0 ? delta / total : 0;
  const deltaBias = imbalance > 0.1 ? "buy_pressure" : imbalance < -0.1 ? "sell_pressure" : "balanced";
  const aggressionBias = Math.abs(imbalance) > 0.2 ? "aggressive" : "moderate";

  return {
    regime: total > 0 ? "active" : "quiet",
    buyVolume: Number(buyVolume.toFixed(4)),
    sellVolume: Number(sellVolume.toFixed(4)),
    delta,
    deltaBias,
    aggressionBias,
    reason: "derived_from_native_trade_stream",
  };
}
