function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function analyzeOrderFlowSignals({ microstructure = {}, tradeFlow = {}, orderBook = {}, synthesis = {} } = {}) {
  const liquidityShift = microstructure.liquidityShift || "unknown";
  const deltaBias = tradeFlow.deltaBias || "unknown";
  const depthBias = orderBook.depthBias || "unknown";
  const spreadPct = Number(orderBook.spreadPct || microstructure.avgSpreadPct || 0) || 0;

  let divergence = "none";
  if (deltaBias === "buy_pressure" && (depthBias === "ask_pressure" || liquidityShift === "ask_strengthening")) divergence = "bullish_flow_vs_offer_resistance";
  if (deltaBias === "sell_pressure" && (depthBias === "bid_support" || liquidityShift === "bid_strengthening")) divergence = "bearish_flow_vs_bid_support";

  const absorption = Boolean(microstructure.absorptionHint) && divergence !== "none";

  let liquiditySweep = "none";
  const imbalanceTrend = Number(microstructure.imbalanceTrend || 0);
  if (deltaBias === "buy_pressure" && imbalanceTrend < -0.1) liquiditySweep = "upside_sweep_risk";
  if (deltaBias === "sell_pressure" && imbalanceTrend > 0.1) liquiditySweep = "downside_sweep_risk";

  let signalBias = "neutral";
  if (deltaBias === "buy_pressure" && !absorption && liquidityShift !== "ask_strengthening") signalBias = "long_confirm";
  if (deltaBias === "sell_pressure" && !absorption && liquidityShift !== "bid_strengthening") signalBias = "short_confirm";
  if (absorption || divergence !== "none") signalBias = "caution";
  if (spreadPct > 0.08) signalBias = "avoid";

  const confidenceImpact = signalBias === "long_confirm" || signalBias === "short_confirm"
    ? 0.08
    : signalBias === "caution"
      ? -0.08
      : signalBias === "avoid"
        ? -0.18
        : 0;

  const reasons = [];
  if (divergence !== "none") reasons.push(divergence);
  if (absorption) reasons.push("absorption_hint");
  if (liquiditySweep !== "none") reasons.push(liquiditySweep);
  if (signalBias === "long_confirm") reasons.push("trade_flow_confirms_longs");
  if (signalBias === "short_confirm") reasons.push("trade_flow_confirms_shorts");
  if (signalBias === "avoid") reasons.push("spread_too_wide_for_clean_execution");
  if (!reasons.length && synthesis.bias && synthesis.bias !== "no_trade") reasons.push("order_flow_neutral");

  return {
    divergence,
    absorption,
    liquiditySweep,
    signalBias,
    confidenceImpact: round(confidenceImpact, 4),
    reasons,
  };
}
