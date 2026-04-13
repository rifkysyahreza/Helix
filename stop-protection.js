import { getTradeById, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { replaceRestingOrder } from "./order-modify.js";
import { recordExecutionIncident } from "./execution-incidents.js";

function roundPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(8));
}

export function deriveProtectedStopPrice({ trade = null, livePosition = null, protectionState = "none" } = {}) {
  if (!trade || !livePosition) return null;
  const entry = Number(livePosition.entryPx || trade.snapshot?.markPx || 0);
  const mark = Number(trade.snapshot?.markPx || livePosition.entryPx || 0);
  const side = trade.side === "short" ? "short" : "long";

  if (!entry || !mark) return null;

  if (protectionState === "break_even_armed") {
    return roundPrice(side === "long" ? entry * 1.001 : entry * 0.999);
  }
  if (protectionState === "profit_locked") {
    const anchor = side === "long" ? Math.max(entry, mark * 0.985) : Math.min(entry, mark * 1.015);
    return roundPrice(anchor);
  }
  return null;
}

export async function applyProfitProtection({ tradeId, livePosition = null, protectionState = null } = {}) {
  const trade = getTradeById(tradeId);
  if (!trade || !livePosition || !protectionState) {
    return { applied: false, reason: "missing_trade_position_or_state", tradeId };
  }

  const stopPrice = deriveProtectedStopPrice({ trade, livePosition, protectionState });
  if (!stopPrice) {
    return { applied: false, reason: "no_stop_price", tradeId, protectionState };
  }

  const result = await replaceRestingOrder({
    tradeId,
    price: stopPrice,
    size: Math.abs(Number(livePosition.szi || 0)),
    tif: "Gtc",
  }).catch((error) => ({ replaced: false, error: error.message }));

  updateTradeExecutionState(tradeId, {
    protectedStopPrice: stopPrice,
    protectedStopState: protectionState,
    protectedStopUpdatedAt: new Date().toISOString(),
    protectedStopResult: result,
  });
  updateTradeLifecycle(tradeId, {
    lastExchangeState: "profit_protection_updated",
  });
  recordExecutionIncident({ kind: "profit_protection_applied", tradeId, protectionState, stopPrice, resultPreview: result?.result || result || null });

  return { applied: true, tradeId, protectionState, stopPrice, result };
}
