import fs from "fs";
import path from "path";
import { listRecentTrades } from "./state.js";
import { getRuntimeDataFile } from "./storage-paths.js";

const FILE = getRuntimeDataFile("autonomy-session-state.json", "HELIX_AUTONOMY_SESSION_STATE_FILE");

function load() {
  if (!fs.existsSync(FILE)) return { updatedAt: null, cooldownSymbols: {}, dailyLockout: false, sessionDegraded: false, reasons: [] };
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { updatedAt: null, cooldownSymbols: {}, dailyLockout: false, sessionDegraded: false, reasons: [] };
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function buildAutonomySessionState({ dailyLossLimitPct = -6, cooldownLosses = 2 } = {}) {
  const trades = listRecentTrades(200).filter((trade) => trade.status === "closed");
  const state = load();
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter((trade) => String(trade.closedAt || trade.updatedAt || "").startsWith(today));
  const todayPnl = todayTrades.reduce((sum, trade) => sum + Number(trade.realizedPnlPct || 0), 0);

  const symbolLosses = {};
  for (const trade of todayTrades) {
    if (Number(trade.realizedPnlPct || 0) < 0) {
      symbolLosses[trade.symbol] = (symbolLosses[trade.symbol] || 0) + 1;
    }
  }

  const cooldownSymbols = Object.fromEntries(
    Object.entries(symbolLosses)
      .filter(([, count]) => count >= cooldownLosses)
      .map(([symbol, count]) => [symbol, { losses: count, active: true }]),
  );

  const reasons = [];
  const dailyLockout = todayPnl <= dailyLossLimitPct;
  const sessionDegraded = dailyLockout || Object.keys(cooldownSymbols).length > 0;
  if (dailyLockout) reasons.push("daily_loss_lockout");
  if (Object.keys(cooldownSymbols).length > 0) reasons.push("symbol_cooldowns_active");

  const next = {
    ...state,
    date: today,
    todayPnl,
    cooldownSymbols,
    dailyLockout,
    sessionDegraded,
    reasons,
  };
  save(next);
  return next;
}

export function getAutonomySessionState() {
  return load();
}
