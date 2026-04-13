function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function buildTradePlanFromAnalysis({ snapshot = null, analysis = null, defaultStopLossPct = 1.5, defaultTakeProfitPct = 3, side = null } = {}) {
  const markPx = Number(snapshot?.markPx || snapshot?.midPx || snapshot?.oraclePx || 0) || null;
  const structure = analysis?.structure || {};
  const volatility = analysis?.volatility || {};
  const vwapValue = analysis?.vwapValue || {};
  const synthesis = analysis?.synthesis || {};
  const microstructure = analysis?.microstructure || {};
  const tradeFlow = analysis?.tradeFlow || {};
  const tradeVeto = analysis?.tradeVeto || {};
  const orderFlowSignals = analysis?.orderFlowSignals || {};

  const location = vwapValue.location || "unknown";
  const atr = Number(volatility?.atr || 0) || null;
  const stopLossBase = location === "inside_value"
    ? Math.max(defaultStopLossPct, defaultStopLossPct * 1.15)
    : defaultStopLossPct;
  const stopLossPct = microstructure.regime === "thin"
    ? round(stopLossBase * 1.1, 2)
    : round(stopLossBase, 2);
  const takeProfitBase = synthesis.confidence >= 0.7
    ? defaultTakeProfitPct * 1.15
    : defaultTakeProfitPct;
  const takeProfitPct = tradeFlow.deltaBias === "balanced"
    ? round(takeProfitBase * 0.9, 2)
    : round(takeProfitBase, 2);

  const invalidation = location === "above_value"
    ? "Lose acceptance above value / VWAP and fail back into value."
    : location === "below_value"
      ? "Lose acceptance below value / VWAP and fail back into value."
      : structure.regime === "compression"
        ? "Break setup fails to expand and price remains trapped in compression."
        : "Structure weakens and the current thesis loses acceptance.";

  let target = "Default measured move continuation target.";
  if (location === "above_value" && side === "long") target = "Look for continuation away from value area high and acceptance above VWAP.";
  if (location === "below_value" && side === "short") target = "Look for continuation away from value area low and acceptance below VWAP.";
  if (location === "inside_value") target = "Inside-value location means weaker extension odds, so target should stay conservative unless expansion confirms.";

  return {
    entryReferencePx: markPx,
    atr,
    invalidation,
    target,
    stopLossPct,
    takeProfitPct,
    executionNotes: [
      synthesis.executionQuality === "poor" ? "Execution quality is poor, so reduce aggression or skip." : "Execution quality is acceptable.",
      microstructure.regime === "thin" ? "Microstructure is thin, so expect worse slippage and avoid size." : "Microstructure is not obviously thin.",
      tradeFlow.deltaBias === "buy_pressure" ? "Trade flow shows buy pressure." : tradeFlow.deltaBias === "sell_pressure" ? "Trade flow shows sell pressure." : "Trade flow is balanced or unavailable.",
      orderFlowSignals.divergence !== "none" ? `Tape-book divergence detected: ${orderFlowSignals.divergence}.` : "No strong tape-book divergence detected.",
      orderFlowSignals.absorption ? "Absorption-style behavior detected, so be careful chasing." : "No strong absorption hint detected.",
      orderFlowSignals.liquiditySweep !== "none" ? `Liquidity sweep risk: ${orderFlowSignals.liquiditySweep}.` : "No obvious liquidity sweep risk.",
      Array.isArray(tradeVeto.cautions) && tradeVeto.cautions.length ? `Live cautions: ${tradeVeto.cautions.join(", ")}.` : "No extra live-flow cautions.",
      atr ? `ATR context is ${atr}.` : "ATR unavailable.",
      `Bias is ${synthesis.bias || "unknown"} with confidence ${synthesis.confidence ?? "n/a"}.`,
    ],
  };
}
