import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { fetchMetaAndAssetContexts, fetchAllMids, fetchClearingState, buildSymbolSnapshot } from "./hyperliquid.js";

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
  if (!snapshot) return score;
  if ((snapshot.dayNtlVlm || 0) >= config.screening.min24hVolumeUsd) score += 2;
  if ((snapshot.openInterest || 0) >= config.screening.minOpenInterestUsd) score += 2;
  if (Math.abs(snapshot.funding || 0) <= config.screening.maxFundingAbsPct) score += 1;
  if ((snapshot.maxLeverage || 0) >= 3) score += 1;
  return score;
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
      const score = scoreSnapshot(snapshot);
      let verdict = "skip";
      let sideBias = "neutral";

      if (score >= 5) verdict = "tradeable";
      else if (score >= 3) verdict = "watch";

      if ((snapshot.funding || 0) < 0) sideBias = "long-bias";
      if ((snapshot.funding || 0) > 0) sideBias = "short-bias";

      return {
        symbol: snapshot.symbol,
        verdict,
        sideBias,
        score,
        funding: snapshot.funding,
        openInterest: snapshot.openInterest,
        dayNtlVlm: snapshot.dayNtlVlm,
        note: "Initial heuristic score from Hyperliquid context. Replace with richer strategy logic next.",
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

    return {
      symbol,
      side,
      mode: process.env.DRY_RUN === "true" ? "dry-run" : "live",
      thesis: snapshot
        ? `Funding=${snapshot.funding}, OI=${snapshot.openInterest}, 24h volume=${snapshot.dayNtlVlm}.`
        : "No market snapshot found.",
      invalidation: `Default stop at ${config.execution.stopLossPct}% until richer structure logic is implemented.`,
      takeProfit: config.execution.takeProfitPct,
      stopLoss: config.execution.stopLossPct,
      trailingStop: config.execution.trailingStopPct,
      sizeUsd: config.execution.defaultPositionSizeUsd,
      snapshot,
    };
  },

  async journal_trade_note({ title, body, tags = [] }) {
    const entry = {
      timestamp: new Date().toISOString(),
      title,
      body,
      tags,
    };
    appendJournal(entry);
    return { saved: true, entry };
  },

  async review_recent_journal({ limit = 10 } = {}) {
    const notes = readJournal(limit);
    return {
      count: notes.length,
      notes,
      summary: notes.length
        ? "Recent journal entries loaded. Review synthesis is still lightweight but data is now real and persisted."
        : "No journal entries yet.",
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
