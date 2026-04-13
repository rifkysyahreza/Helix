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
    }))
    .filter((candle) => candle.open != null && candle.high != null && candle.low != null && candle.close != null);
}

export function analyzeVolatility(candles = []) {
  const series = normalizeCandles(candles);
  if (series.length < 5) {
    return { atr: null, regime: "unknown", expansion: false, compression: false, reason: "not_enough_candles" };
  }

  const trueRanges = [];
  for (let i = 1; i < series.length; i += 1) {
    const current = series[i];
    const prevClose = series[i - 1].close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
    trueRanges.push(tr);
  }

  const recent = trueRanges.slice(-5);
  const older = trueRanges.slice(-10, -5);
  const atr = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
  const olderAtr = older.length ? older.reduce((sum, value) => sum + value, 0) / older.length : atr;
  const ratio = olderAtr ? atr / olderAtr : 1;

  const expansion = ratio > 1.2;
  const compression = ratio < 0.85;
  const regime = expansion ? "expansion" : compression ? "compression" : "normal";

  return {
    atr: Number(atr.toFixed(6)),
    atrRatioVsPrior: Number(ratio.toFixed(3)),
    regime,
    expansion,
    compression,
    reason: expansion ? "atr_expanding" : compression ? "atr_compressing" : "atr_stable",
  };
}
