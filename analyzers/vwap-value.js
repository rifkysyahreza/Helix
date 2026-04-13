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
    }))
    .filter((candle) => candle.high != null && candle.low != null && candle.close != null && candle.volume != null);
}

function typicalPrice(candle) {
  return (candle.high + candle.low + candle.close) / 3;
}

export function analyzeVwapAndValue(candles = []) {
  const series = normalizeCandles(candles);
  if (series.length < 5) {
    return { vwap: null, valueAreaLow: null, valueAreaHigh: null, poc: null, location: "unknown", reason: "not_enough_candles" };
  }

  let cumulativePv = 0;
  let cumulativeVol = 0;
  const buckets = new Map();

  for (const candle of series) {
    const tp = typicalPrice(candle);
    cumulativePv += tp * candle.volume;
    cumulativeVol += candle.volume;
    const bucket = Number(tp.toFixed(2));
    buckets.set(bucket, (buckets.get(bucket) || 0) + candle.volume);
  }

  const vwap = cumulativeVol > 0 ? cumulativePv / cumulativeVol : null;
  const lastClose = series[series.length - 1].close;
  const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
  const poc = sortedBuckets[0]?.[0] ?? null;

  const totalVolume = Array.from(buckets.values()).reduce((sum, v) => sum + v, 0);
  const targetVolume = totalVolume * 0.7;
  let accumulated = 0;
  const selectedPrices = [];
  for (const [price, vol] of sortedBuckets) {
    selectedPrices.push(price);
    accumulated += vol;
    if (accumulated >= targetVolume) break;
  }

  const valueAreaLow = selectedPrices.length ? Math.min(...selectedPrices) : null;
  const valueAreaHigh = selectedPrices.length ? Math.max(...selectedPrices) : null;

  let location = "inside_value";
  let reason = "price_inside_value_area";
  if (lastClose != null && valueAreaHigh != null && lastClose > valueAreaHigh) {
    location = "above_value";
    reason = "price_above_value_area";
  } else if (lastClose != null && valueAreaLow != null && lastClose < valueAreaLow) {
    location = "below_value";
    reason = "price_below_value_area";
  }

  return {
    vwap: vwap != null ? Number(vwap.toFixed(4)) : null,
    poc,
    valueAreaLow,
    valueAreaHigh,
    location,
    reason,
    lastClose,
    distanceFromVwapPct: vwap && lastClose ? Number((((lastClose - vwap) / vwap) * 100).toFixed(2)) : null,
  };
}
