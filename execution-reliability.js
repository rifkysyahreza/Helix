import { listRecentTrades } from "./state.js";
import { summarizeExecutionIncidents } from "./execution-incidents.js";
import { config } from "./config.js";

export function buildExecutionReliabilitySummary(limit = 200, { mode = null } = {}) {
  const trades = listRecentTrades(limit);
  const bySymbol = {};

  for (const trade of trades) {
    const symbol = trade.symbol;
    const outcome = trade.executionState?.lastCloseOutcome || trade.executionState?.lastReduceOutcome || trade.executionState?.lastOpenOutcome || null;
    const lifecyclePhase = trade.lifecyclePhase || "unknown";
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
        phases: {},
        total: 0,
      };
    }

    bySymbol[symbol][outcome] = (bySymbol[symbol][outcome] || 0) + 1;
    bySymbol[symbol].phases[lifecyclePhase] = (bySymbol[symbol].phases[lifecyclePhase] || 0) + 1;
    bySymbol[symbol].total += 1;
  }

  for (const symbol of Object.keys(bySymbol)) {
    const row = bySymbol[symbol];
    row.reliabilityScore = row.total
      ? Number((((row.filled + (row.partial_fill * 0.5)) - row.ioc_cancel - row.error) / row.total).toFixed(2))
      : 0;
  }

  const currentMode = mode || config.execution.mode || "paper";
  const incidents = summarizeExecutionIncidents(300, { mode: currentMode });

  return {
    currentMode,
    bySymbol,
    incidents,
    worstSymbols: Object.values(bySymbol)
      .sort((a, b) => a.reliabilityScore - b.reliabilityScore)
      .slice(0, 5),
  };
}
