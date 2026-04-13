import { analyzeMarketStructure } from "./market-structure.js";
import { analyzeVolatility } from "./volatility.js";

export function analyzeMultiTimeframe(timeframes = {}) {
  const entries = Object.entries(timeframes || {});
  if (!entries.length) {
    return { bias: "unknown", alignment: "unknown", frames: {}, reason: "no_timeframes" };
  }

  const frames = {};
  let longVotes = 0;
  let shortVotes = 0;

  for (const [label, candles] of entries) {
    const structure = analyzeMarketStructure(candles || []);
    const volatility = analyzeVolatility(candles || []);
    frames[label] = { structure, volatility };
    if (structure.trendBias === "long") longVotes += 1;
    if (structure.trendBias === "short") shortVotes += 1;
  }

  let bias = "neutral";
  let alignment = "mixed";
  if (longVotes > shortVotes) bias = "long";
  if (shortVotes > longVotes) bias = "short";
  if ((longVotes > 0 && shortVotes === 0) || (shortVotes > 0 && longVotes === 0)) alignment = "aligned";
  if (longVotes === 0 && shortVotes === 0) alignment = "neutral";

  return {
    bias,
    alignment,
    longVotes,
    shortVotes,
    frames,
    reason: alignment === "aligned" ? "timeframes_agree" : alignment === "mixed" ? "timeframes_mixed" : "timeframes_neutral",
  };
}
