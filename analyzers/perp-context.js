function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function analyzePerpContext({ snapshot = null, fundingHistory = [] } = {}) {
  const funding = toNumber(snapshot?.funding);
  const openInterest = toNumber(snapshot?.openInterest);
  const premium = toNumber(snapshot?.premium);
  const dayNtlVlm = toNumber(snapshot?.dayNtlVlm);
  const recentFunding = fundingHistory.map((item) => toNumber(item?.fundingRate ?? item?.funding ?? item?.rate)).filter((x) => x != null);
  const avgRecentFunding = recentFunding.length
    ? recentFunding.reduce((sum, value) => sum + value, 0) / recentFunding.length
    : funding;

  let crowding = "normal";
  let bias = "neutral";
  const signals = [];

  if (funding != null && funding > 0.0005) {
    crowding = "long_crowded";
    bias = "cautious_long";
    signals.push("positive_funding_crowding");
  } else if (funding != null && funding < -0.0005) {
    crowding = "short_crowded";
    bias = "cautious_short";
    signals.push("negative_funding_crowding");
  }

  if (premium != null && premium > 0) signals.push("trading_above_oracle");
  if (premium != null && premium < 0) signals.push("trading_below_oracle");
  if (openInterest != null && openInterest > 0) signals.push("open_interest_present");
  if (dayNtlVlm != null && dayNtlVlm > 0) signals.push("volume_present");

  return {
    funding,
    avgRecentFunding: avgRecentFunding != null ? Number(avgRecentFunding.toFixed(6)) : null,
    openInterest,
    premium,
    dayNtlVlm,
    crowding,
    bias,
    signals,
  };
}
