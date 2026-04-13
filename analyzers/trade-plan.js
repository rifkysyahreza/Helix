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

  const location = vwapValue.location || "unknown";
  const atr = Number(volatility?.atr || 0) || null;
  const stopLossPct = location === "inside_value"
    ? round(Math.max(defaultStopLossPct, defaultStopLossPct * 1.15), 2)
    : round(defaultStopLossPct, 2);
  const takeProfitPct = synthesis.confidence >= 0.7
    ? round(defaultTakeProfitPct * 1.15, 2)
    : round(defaultTakeProfitPct, 2);

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
      atr ? `ATR context is ${atr}.` : "ATR unavailable.",
      `Bias is ${synthesis.bias || "unknown"} with confidence ${synthesis.confidence ?? "n/a"}.`,
    ],
  };
}
