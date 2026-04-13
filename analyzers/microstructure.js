export function analyzeMicrostructureHistory(samples = []) {
  const series = Array.isArray(samples) ? samples.filter(Boolean) : [];
  if (series.length < 3) {
    return { regime: "unknown", imbalanceTrend: null, spreadTrend: null, liquidityShift: "unknown", absorptionHint: false, reason: "not_enough_samples" };
  }

  const recent = series.slice(-10);
  const imbalances = recent.map((item) => Number(item.imbalance || 0));
  const spreads = recent.map((item) => Number(item.spreadPct || 0));
  const bidDepths = recent.map((item) => Number(item.bidDepth || 0));
  const askDepths = recent.map((item) => Number(item.askDepth || 0));

  const avgImbalance = imbalances.reduce((sum, v) => sum + v, 0) / imbalances.length;
  const avgSpread = spreads.reduce((sum, v) => sum + v, 0) / spreads.length;
  const firstImbalance = imbalances[0];
  const lastImbalance = imbalances[imbalances.length - 1];
  const spreadTrend = spreads[spreads.length - 1] - spreads[0];
  const bidDepthTrend = bidDepths[bidDepths.length - 1] - bidDepths[0];
  const askDepthTrend = askDepths[askDepths.length - 1] - askDepths[0];

  let liquidityShift = "stable";
  if (bidDepthTrend > 0 && askDepthTrend < 0) liquidityShift = "bid_strengthening";
  else if (bidDepthTrend < 0 && askDepthTrend > 0) liquidityShift = "ask_strengthening";

  const imbalanceTrend = lastImbalance - firstImbalance;
  const absorptionHint = Math.abs(avgImbalance) > 0.15 && Math.abs(spreadTrend) < 0.01;
  const regime = avgSpread > 0.08 ? "thin" : "tradable";

  return {
    regime,
    avgImbalance: Number(avgImbalance.toFixed(4)),
    avgSpreadPct: Number(avgSpread.toFixed(4)),
    imbalanceTrend: Number(imbalanceTrend.toFixed(4)),
    spreadTrend: Number(spreadTrend.toFixed(4)),
    liquidityShift,
    absorptionHint,
    reason: absorptionHint ? "pressure_without_large_spread_change" : "rolling_microstructure_summary",
  };
}
