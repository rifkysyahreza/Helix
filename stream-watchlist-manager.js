import { listRecentTrades } from "./state.js";
import { config } from "./config.js";
import { subscribeSymbolOrderBook, subscribeSymbolTrades, listSubscribedSymbols } from "./market-stream.js";

export function buildManagedWatchlist() {
  const configured = Array.isArray(config.screening.allowedSymbols) ? config.screening.allowedSymbols : [];
  const openTradeSymbols = listRecentTrades(200)
    .filter((trade) => trade.status === "open")
    .map((trade) => trade.symbol);
  return Array.from(new Set([...configured, ...openTradeSymbols].map((item) => String(item || "").toUpperCase()).filter(Boolean)));
}

export async function ensureManagedStreams() {
  const symbols = buildManagedWatchlist();
  const results = [];
  for (const symbol of symbols) {
    const orderBook = await subscribeSymbolOrderBook(symbol).catch((error) => ({ subscribed: false, symbol, error: error.message }));
    const trades = await subscribeSymbolTrades(symbol).catch((error) => ({ subscribed: false, symbol, error: error.message }));
    results.push({ symbol, orderBook, trades });
  }
  return {
    symbols,
    results,
    subscribed: listSubscribedSymbols(),
  };
}
