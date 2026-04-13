import { config } from "./config.js";
import { listRecentTrades } from "./state.js";

export function buildRegimeThrottle({ analysesBySymbol = {} } = {}) {
  const openTrades = listRecentTrades(200).filter((trade) => trade.status === "open");
  const longCount = openTrades.filter((trade) => trade.side === "long").length;
  const shortCount = openTrades.filter((trade) => trade.side === "short").length;
  const directionalCrowding = longCount >= 2 || shortCount >= 2;

  const hostileRegimeSymbols = openTrades.filter((trade) => {
    const analysis = analysesBySymbol?.[trade.symbol] || null;
    const bias = analysis?.synthesis?.bias || null;
    return bias && bias !== trade.side;
  }).map((trade) => trade.symbol);

  let autonomyLevel = "normal";
  const reasons = [];
  if (directionalCrowding) {
    autonomyLevel = "degraded";
    reasons.push("directional_crowding");
  }
  if (hostileRegimeSymbols.length >= 2) {
    autonomyLevel = "halt_new_entries";
    reasons.push("hostile_regime_alignment");
  }
  if (config.screening.regime === "mean-reversion" && longCount + shortCount >= 3) {
    autonomyLevel = "degraded";
    reasons.push("regime_density_throttle");
  }

  return {
    autonomyLevel,
    reasons,
    longCount,
    shortCount,
    hostileRegimeSymbols,
  };
}
