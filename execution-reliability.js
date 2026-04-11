import { listRecentTrades } from "./state.js";

export function buildExecutionReliabilitySummary(limit = 200) {
  const trades = listRecentTrades(limit);
  const bySymbol = {};

  for (const trade of trades) {
    const symbol = trade.symbol;
    const outcome = trade.executionState?.lastCloseOutcome || trade.executionState?.lastReduceOutcome || null;
    if (!symbol || !outcome) continue;

    if (!bySymbol[symbol]) {
      bySymbol[symbol] = {
        symbol,
        filled: 0,
        partial_fill: 0,
        resting: 0,
        ioc_cancel: 0,
        error: 0,
        unknown: 0,
        total: 0,
      };
    }

    bySymbol[symbol][outcome] = (bySymbol[symbol][outcome] || 0) + 1;
    bySymbol[symbol].total += 1;
  }

  for (const symbol of Object.keys(bySymbol)) {
    const row = bySymbol[symbol];
    row.reliabilityScore = row.total
      ? Number((((row.filled + (row.partial_fill * 0.5)) - row.ioc_cancel - row.error) / row.total).toFixed(2))
      : 0;
  }

  return {
    bySymbol,
    worstSymbols: Object.values(bySymbol)
      .sort((a, b) => a.reliabilityScore - b.reliabilityScore)
      .slice(0, 5),
  };
}
