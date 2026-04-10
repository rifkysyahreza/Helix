import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { fetchMetaAndAssetContexts, fetchAllMids, fetchClearingState, buildSymbolSnapshot } from "./hyperliquid.js";
import { createTradeRecord, reduceTradeRecord, closeTradeRecord, listRecentTrades } from "../state.js";
import { openPerpPosition, closePerpPosition } from "../execution.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL_DIR = path.join(__dirname, "..", "journal");
const JOURNAL_PATH = path.join(JOURNAL_DIR, "notes.jsonl");

function ensureJournalDir() {
  if (!fs.existsSync(JOURNAL_DIR)) fs.mkdirSync(JOURNAL_DIR, { recursive: true });
}

function appendJournal(entry) {
  ensureJournalDir();
  fs.appendFileSync(JOURNAL_PATH, `${JSON.stringify(entry)}\n`);
}

function readJournal(limit = 10) {
  if (!fs.existsSync(JOURNAL_PATH)) return [];
  const raw = fs.readFileSync(JOURNAL_PATH, "utf8").trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { malformed: true, raw: line };
    }
  });
}

function defaultSymbols() {
  return config.screening.allowedSymbols?.length ? config.screening.allowedSymbols : ["BTC", "ETH", "SOL"];
}

function scoreSnapshot(snapshot) {
  let score = 0;
  if (!snapshot) return { score, setupQuality: "skip", sideBias: "neutral", reasons: ["missing_snapshot"] };

  const reasons = [];
  if ((snapshot.dayNtlVlm || 0) >= config.screening.min24hVolumeUsd) {
    score += 2;
    reasons.push("strong_volume");
  }
  if ((snapshot.openInterest || 0) >= config.screening.minOpenInterestUsd) {
    score += 2;
    reasons.push("strong_oi");
  }
  if (Math.abs(snapshot.funding || 0) <= config.screening.maxFundingAbsPct) {
    score += 1;
    reasons.push("funding_not_extreme");
  }
  if ((snapshot.maxLeverage || 0) >= 3) {
    score += 1;
    reasons.push("sufficient_leverage_headroom");
  }
  if ((snapshot.premium || 0) < 0) {
    score += 1;
    reasons.push("discount_to_oracle");
  }
  if ((snapshot.premium || 0) > 0) {
    score -= 1;
    reasons.push("premium_to_oracle");
  }

  let setupQuality = "skip";
  if (score >= 6) setupQuality = "tradeable";
  else if (score >= 3) setupQuality = "watch";

  let sideBias = "neutral";
  if ((snapshot.funding || 0) < 0 && (snapshot.premium || 0) <= 0) sideBias = "long-bias";
  if ((snapshot.funding || 0) > 0 && (snapshot.premium || 0) >= 0) sideBias = "short-bias";

  return { score, setupQuality, sideBias, reasons };
}

function writeLifecycleJournal(kind, payload) {
  appendJournal({
    timestamp: new Date().toISOString(),
    type: "trade_lifecycle",
    kind,
    payload,
  });
}

function extractTradeLessons(trades) {
  const closed = trades.filter((trade) => trade.status === "closed");
  if (!closed.length) {
    return ["No closed trades yet. Collect more execution history before tuning hard rules."];
  }

  const positive = closed.filter((trade) => (trade.realizedPnlPct || 0) > 0);
  const negative = closed.filter((trade) => (trade.realizedPnlPct || 0) < 0);
  const lessons = [];

  if (positive.length) {
    const best = positive.sort((a, b) => (b.realizedPnlPct || 0) - (a.realizedPnlPct || 0))[0];
    lessons.push(`Best recent trade: ${best.symbol} ${best.side} closed at ${best.realizedPnlPct}% with thesis: ${best.thesis || "n/a"}.`);
  }

  if (negative.length) {
    const worst = negative.sort((a, b) => (a.realizedPnlPct || 0) - (b.realizedPnlPct || 0))[0];
    lessons.push(`Worst recent trade: ${worst.symbol} ${worst.side} closed at ${worst.realizedPnlPct}% with reason: ${worst.closeReason || "n/a"}.`);
  }

  const groupedBySymbol = Object.values(closed.reduce((acc, trade) => {
    if (!acc[trade.symbol]) acc[trade.symbol] = { symbol: trade.symbol, count: 0, pnl: 0 };
    acc[trade.symbol].count += 1;
    acc[trade.symbol].pnl += trade.realizedPnlPct || 0;
    return acc;
  }, {}));

  groupedBySymbol
    .filter((item) => item.count >= 2)
    .forEach((item) => {
      lessons.push(`Symbol review: ${item.symbol} average closed PnL ${(item.pnl / item.count).toFixed(2)}% over ${item.count} trades.`);
    });

  return lessons;
}

const toolMap = {
  async get_market_context({ symbols } = {}) {
    const watch = symbols?.length ? symbols : defaultSymbols();
    const [metaAndAssetCtxs, mids] = await Promise.all([
      fetchMetaAndAssetContexts(),
      fetchAllMids(),
    ]);

    const snapshots = watch.map((symbol) => buildSymbolSnapshot(symbol, metaAndAssetCtxs.assetContexts, mids)).filter(Boolean);
    return {
      source: "hyperliquid",
      symbols: snapshots,
    };
  },

  async list_account_state() {
    const user = process.env.HYPERLIQUID_ACCOUNT_ADDRESS || "";
    const state = await fetchClearingState(user);

    return {
      source: "hyperliquid",
      dryRun: process.env.DRY_RUN === "true",
      accountAddress: user || null,
      missingAccountAddress: !user,
      risk: config.risk,
      marginSummary: state?.marginSummary || null,
      positions: state?.assetPositions || [],
      raw: !user ? null : state,
    };
  },

  async rank_trade_setups({ symbols } = {}) {
    const context = await toolMap.get_market_context({ symbols });
    const candidates = context.symbols.map((snapshot) => {
      const scored = scoreSnapshot(snapshot);
      return {
        symbol: snapshot.symbol,
        verdict: scored.setupQuality,
        sideBias: scored.sideBias,
        score: scored.score,
        reasons: scored.reasons,
        funding: snapshot.funding,
        openInterest: snapshot.openInterest,
        dayNtlVlm: snapshot.dayNtlVlm,
        premium: snapshot.premium,
        note: "Initial heuristic score from Hyperliquid context. Replace with richer structure logic next.",
      };
    }).sort((a, b) => b.score - a.score);

    return {
      source: "hyperliquid",
      regime: config.screening.regime,
      timeframe: config.screening.timeframe,
      candidates,
    };
  },

  async propose_trade({ symbol, side }) {
    const context = await toolMap.get_market_context({ symbols: [symbol] });
    const snapshot = context.symbols[0] || null;
    const scored = scoreSnapshot(snapshot);

    return {
      symbol,
      side,
      mode: process.env.DRY_RUN === "true" ? "dry-run" : "live",
      thesis: snapshot
        ? `Funding=${snapshot.funding}, OI=${snapshot.openInterest}, 24h volume=${snapshot.dayNtlVlm}, premium=${snapshot.premium}. Bias=${scored.sideBias}.`
        : "No market snapshot found.",
      invalidation: `Default stop at ${config.execution.stopLossPct}% until richer structure logic is implemented.`,
      takeProfit: config.execution.takeProfitPct,
      stopLoss: config.execution.stopLossPct,
      trailingStop: config.execution.trailingStopPct,
      sizeUsd: config.execution.defaultPositionSizeUsd,
      snapshot,
      scored,
    };
  },

  async place_order({ symbol, side, sizeUsd, thesis, stopLossPct, takeProfitPct, leverage = 1 }) {
    const proposal = await toolMap.propose_trade({ symbol, side });
    const execution = await openPerpPosition({
      symbol,
      side,
      sizeUsd: sizeUsd ?? proposal.sizeUsd,
      leverage,
    });
    if (!execution.success) {
      return execution;
    }
    const trade = createTradeRecord({
      symbol,
      side,
      sizeUsd: sizeUsd ?? proposal.sizeUsd,
      thesis: thesis || proposal.thesis,
      stopLossPct: stopLossPct ?? proposal.stopLoss,
      takeProfitPct: takeProfitPct ?? proposal.takeProfit,
      snapshot: proposal.snapshot,
    });
    writeLifecycleJournal("place_order", { trade, execution });
    return {
      mode: execution.context.mode,
      placed: true,
      trade,
      execution,
    };
  },

  async reduce_position({ tradeId, reducePct, reason }) {
    const trade = reduceTradeRecord(tradeId, { reducePct, reason });
    if (!trade) return { error: `Trade not found: ${tradeId}` };
    writeLifecycleJournal("reduce_position", { tradeId, reducePct, reason });
    return {
      reduced: true,
      trade,
    };
  },

  async close_position({ tradeId, reason, exitPrice, realizedPnlPct }) {
    const trades = listRecentTrades(100);
    const existing = trades.find((trade) => trade.tradeId === tradeId);
    if (!existing) return { error: `Trade not found: ${tradeId}` };
    const execution = await closePerpPosition({ trade: existing });
    if (!execution.success) {
      return execution;
    }
    const trade = closeTradeRecord(tradeId, { reason, exitPrice, realizedPnlPct });
    writeLifecycleJournal("close_position", { tradeId, reason, exitPrice, realizedPnlPct, execution });
    return {
      closed: true,
      trade,
      execution,
    };
  },

  async journal_trade_note({ title, body, tags = [] }) {
    const entry = {
      timestamp: new Date().toISOString(),
      type: "note",
      title,
      body,
      tags,
    };
    appendJournal(entry);
    return { saved: true, entry };
  },

  async review_recent_journal({ limit = 10 } = {}) {
    const notes = readJournal(limit);
    const trades = listRecentTrades(limit);
    const closed = trades.filter((trade) => trade.status === "closed");
    const open = trades.filter((trade) => trade.status === "open");
    const avgClosedPnl = closed.length
      ? closed.reduce((sum, trade) => sum + (trade.realizedPnlPct || 0), 0) / closed.length
      : null;

    return {
      count: notes.length,
      notes,
      recentTrades: trades,
      lessons: {
        openTrades: open.length,
        closedTrades: closed.length,
        avgClosedPnlPct: avgClosedPnl,
        extracted: extractTradeLessons(trades),
        summary: closed.length
          ? `Recent closed trades average ${avgClosedPnl?.toFixed(2)}% PnL across ${closed.length} trades.`
          : "No closed trades yet. Focus on collecting more execution history.",
      },
    };
  },
};

export async function executeTool(name, args = {}) {
  const fn = toolMap[name];
  if (!fn) {
    return { error: `Unknown Helix tool: ${name}` };
  }
  return await fn(args);
}
