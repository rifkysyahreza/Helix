import fs from "fs";

const STATE_FILE = "./state.json";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function load() {
  if (!fs.existsSync(STATE_FILE)) {
    return { trades: {}, lastUpdated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { trades: {}, lastUpdated: null };
  }
}

function save(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function makeTradeId(symbol) {
  return `${symbol}-${Date.now()}`;
}

export function createTradeRecord({ symbol, side, sizeUsd, thesis, stopLossPct, takeProfitPct, snapshot, exchange = null }) {
  const state = load();
  const normalizedSymbol = normalizeSymbol(symbol);
  const existingOpenTrade = Object.values(state.trades).find((trade) => trade.status === "open" && normalizeSymbol(trade.symbol) === normalizedSymbol);

  if (existingOpenTrade) {
    return {
      ...existingOpenTrade,
      duplicateOpenTrade: true,
    };
  }

  const tradeId = makeTradeId(normalizedSymbol);
  state.trades[tradeId] = {
    tradeId,
    symbol: normalizedSymbol,
    side,
    sizeUsd,
    thesis,
    stopLossPct,
    takeProfitPct,
    snapshot,
    exchange,
    status: "open",
    reductions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  save(state);
  return state.trades[tradeId];
}

export function reduceTradeRecord(tradeId, { reducePct, reason }) {
  const state = load();
  const trade = state.trades[tradeId];
  if (!trade) return null;
  trade.reductions.push({
    reducePct,
    reason: reason || null,
    timestamp: new Date().toISOString(),
  });
  trade.updatedAt = new Date().toISOString();
  save(state);
  return trade;
}

export function closeTradeRecord(tradeId, { reason, exitPrice, realizedPnlPct, exchange = null }) {
  const state = load();
  const trade = state.trades[tradeId];
  if (!trade) return null;
  trade.status = "closed";
  trade.closeReason = reason || null;
  trade.exitPrice = exitPrice ?? null;
  trade.realizedPnlPct = realizedPnlPct ?? null;
  if (exchange) trade.exchange = { ...(trade.exchange || {}), ...exchange };
  trade.closedAt = new Date().toISOString();
  trade.updatedAt = new Date().toISOString();
  save(state);
  return trade;
}

export function updateTradeExchange(tradeId, exchangePatch) {
  const state = load();
  const trade = state.trades[tradeId];
  if (!trade) return null;
  trade.exchange = { ...(trade.exchange || {}), ...(exchangePatch || {}) };
  trade.updatedAt = new Date().toISOString();
  save(state);
  return trade;
}

export function updateTradeExecutionState(tradeId, executionStatePatch) {
  const state = load();
  const trade = state.trades[tradeId];
  if (!trade) return null;
  trade.executionState = { ...(trade.executionState || {}), ...(executionStatePatch || {}) };
  trade.updatedAt = new Date().toISOString();
  save(state);
  return trade;
}

export function updateTradeLifecycle(tradeId, lifecyclePatch) {
  const state = load();
  const trade = state.trades[tradeId];
  if (!trade) return null;
  Object.assign(trade, lifecyclePatch || {});
  trade.updatedAt = new Date().toISOString();
  save(state);
  return trade;
}

export function listRecentTrades(limit = 10) {
  const state = load();
  return Object.values(state.trades)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, limit);
}
