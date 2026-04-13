function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCandles(candles = []) {
  return candles
    .map((candle) => ({
      high: toNumber(candle.h ?? candle.high),
      low: toNumber(candle.l ?? candle.low),
      close: toNumber(candle.c ?? candle.close),
      volume: toNumber(candle.v ?? candle.volume),
    }))
    .filter((candle) => candle.high != null && candle.low != null && candle.close != null && candle.volume != null);
}

export function analyzeVolumeProfile(candles = [], bucketSize = null) {
  const series = normalizeCandles(candles);
  if (series.length < 5) {
    return { poc: null, hvn: [], lvn: [], buckets: [], reason: "not_enough_candles" };
  }

  const closes = series.map((candle) => candle.close);
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);
  const inferredBucket = bucketSize || Math.max(0.1, Number((((maxPrice - minPrice) || 1) / 20).toFixed(4)));

  const buckets = new Map();
  for (const candle of series) {
    const price = candle.close;
    const bucket = Number((Math.round(price / inferredBucket) * inferredBucket).toFixed(4));
    buckets.set(bucket, (buckets.get(bucket) || 0) + candle.volume);
  }

  const ranked = Array.from(buckets.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => b.volume - a.volume);

  const poc = ranked[0]?.price ?? null;
  const hvn = ranked.slice(0, Math.min(3, ranked.length)).map((row) => row.price);
  const lvn = [...ranked]
    .sort((a, b) => a.volume - b.volume)
    .slice(0, Math.min(3, ranked.length))
    .map((row) => row.price);

  return {
    poc,
    hvn,
    lvn,
    bucketSize: inferredBucket,
    buckets: ranked,
    reason: "derived_from_candle_close_volume_distribution",
  };
}
