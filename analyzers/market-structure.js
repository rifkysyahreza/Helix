function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCandles(candles = []) {
  return candles
    .map((candle) => ({
      open: toNumber(candle.o ?? candle.open),
      high: toNumber(candle.h ?? candle.high),
      low: toNumber(candle.l ?? candle.low),
      close: toNumber(candle.c ?? candle.close),
      volume: toNumber(candle.v ?? candle.volume),
      time: candle.t ?? candle.time ?? null,
    }))
    .filter((candle) => candle.open != null && candle.high != null && candle.low != null && candle.close != null);
}

export function analyzeMarketStructure(candles = []) {
  const series = normalizeCandles(candles);
  if (series.length < 5) {
    return { regime: "unknown", trendBias: "neutral", confidence: 0, reason: "not_enough_candles" };
  }

  const recent = series.slice(-5);
  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].high > recent[i - 1].high) higherHighs += 1;
    if (recent[i].low > recent[i - 1].low) higherLows += 1;
    if (recent[i].high < recent[i - 1].high) lowerHighs += 1;
    if (recent[i].low < recent[i - 1].low) lowerLows += 1;
  }

  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;
  const netMovePct = firstClose ? Number((((lastClose - firstClose) / firstClose) * 100).toFixed(2)) : 0;
  const rangeHigh = Math.max(...recent.map((c) => c.high));
  const rangeLow = Math.min(...recent.map((c) => c.low));
  const rangePct = rangeLow > 0 ? Number((((rangeHigh - rangeLow) / rangeLow) * 100).toFixed(2)) : 0;

  let regime = "balance";
  let trendBias = "neutral";
  let confidence = 0.4;
  let reason = "balanced_recent_structure";

  if (higherHighs >= 3 && higherLows >= 3 && netMovePct > 0) {
    regime = "trend";
    trendBias = "long";
    confidence = 0.75;
    reason = "higher_highs_and_higher_lows";
  } else if (lowerHighs >= 3 && lowerLows >= 3 && netMovePct < 0) {
    regime = "trend";
    trendBias = "short";
    confidence = 0.75;
    reason = "lower_highs_and_lower_lows";
  } else if (rangePct < 1.5) {
    regime = "compression";
    trendBias = "neutral";
    confidence = 0.65;
    reason = "tight_recent_range";
  }

  return {
    regime,
    trendBias,
    confidence,
    reason,
    netMovePct,
    rangePct,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
  };
}
