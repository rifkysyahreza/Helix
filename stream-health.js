import { buildManagedWatchlist, ensureManagedStreams } from "./stream-watchlist-manager.js";
import { getMarketStreamSnapshot, updateMarketStreamSnapshot } from "./market-stream-state.js";

export function evaluateStreamHealth({ staleMs = 5 * 60 * 1000 } = {}) {
  const symbols = buildManagedWatchlist();
  const now = Date.now();
  const staleSymbols = [];

  for (const symbol of symbols) {
    const snapshot = getMarketStreamSnapshot(symbol);
    const at = snapshot?.at ? new Date(snapshot.at).getTime() : null;
    const stale = !at || (now - at) > staleMs;
    if (stale) {
      staleSymbols.push({ symbol, lastUpdateAt: snapshot?.at || null, reason: at ? "stale_snapshot" : "missing_snapshot" });
    }
  }

  return {
    symbols,
    staleSymbols,
    healthy: staleSymbols.length === 0,
    staleMs,
  };
}

export async function repairStreamHealth({ staleMs = 5 * 60 * 1000 } = {}) {
  const health = evaluateStreamHealth({ staleMs });
  if (health.healthy) {
    return { repaired: false, health };
  }

  const refreshed = await ensureManagedStreams();
  for (const item of health.staleSymbols) {
    updateMarketStreamSnapshot(item.symbol, {
      streamHealthRepairAt: new Date().toISOString(),
      streamHealthRepairReason: item.reason,
    });
  }

  return {
    repaired: true,
    health,
    refreshed,
  };
}
