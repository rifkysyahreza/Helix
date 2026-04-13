export function synthesizeMarketAnalysis({
  structure = null,
  volatility = null,
  vwapValue = null,
  volumeProfile = null,
  perpContext = null,
  orderBook = null,
} = {}) {
  let longScore = 0;
  let shortScore = 0;
  const reasons = [];
  const riskFlags = [];

  if (structure?.trendBias === "long") {
    longScore += 2;
    reasons.push(`structure_long:${structure.reason}`);
  } else if (structure?.trendBias === "short") {
    shortScore += 2;
    reasons.push(`structure_short:${structure.reason}`);
  }

  if (volatility?.expansion) {
    reasons.push("volatility_expansion");
    if (structure?.trendBias === "long") longScore += 1;
    if (structure?.trendBias === "short") shortScore += 1;
  }
  if (volatility?.compression) {
    riskFlags.push("volatility_compression");
  }

  if (vwapValue?.location === "above_value") {
    longScore += 1;
    reasons.push("price_above_value");
  } else if (vwapValue?.location === "below_value") {
    shortScore += 1;
    reasons.push("price_below_value");
  } else {
    riskFlags.push("price_inside_value");
  }

  if (perpContext?.crowding === "long_crowded") {
    longScore -= 1;
    riskFlags.push("long_crowding");
  } else if (perpContext?.crowding === "short_crowded") {
    shortScore -= 1;
    riskFlags.push("short_crowding");
  }

  if (orderBook?.depthBias === "bid_support") {
    longScore += 1;
    reasons.push("bid_support");
  } else if (orderBook?.depthBias === "ask_pressure") {
    shortScore += 1;
    reasons.push("ask_pressure");
  }

  if (orderBook?.executionQuality === "poor") {
    riskFlags.push("poor_execution_quality");
  }

  const poc = volumeProfile?.poc;
  if (poc != null && vwapValue?.lastClose != null) {
    if (vwapValue.lastClose > poc) longScore += 0.5;
    if (vwapValue.lastClose < poc) shortScore += 0.5;
  }

  let bias = "no_trade";
  let confidence = 0.35;
  if (longScore >= shortScore + 2) {
    bias = "long";
    confidence = 0.7;
  } else if (shortScore >= longScore + 2) {
    bias = "short";
    confidence = 0.7;
  } else if (Math.max(longScore, shortScore) >= 2) {
    bias = longScore >= shortScore ? "watch_long" : "watch_short";
    confidence = 0.55;
  }

  if (riskFlags.includes("poor_execution_quality")) confidence -= 0.1;
  if (riskFlags.includes("price_inside_value")) confidence -= 0.05;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  return {
    bias,
    confidence,
    longScore: Number(longScore.toFixed(2)),
    shortScore: Number(shortScore.toFixed(2)),
    reasons,
    riskFlags,
    executionQuality: orderBook?.executionQuality || "unknown",
    location: vwapValue?.location || "unknown",
    crowding: perpContext?.crowding || "unknown",
  };
}
