import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { fetchMetaAndAssetContexts, fetchAllMids, fetchClearingState, fetchCandles, fetchFunding, fetchL2Book, buildSymbolSnapshot } from "./hyperliquid.js";
import { createTradeRecord, reduceTradeRecord, closeTradeRecord, listRecentTrades, updateTradeExchange, updateTradeExecutionState } from "../state.js";
import { openPerpPosition, closePerpPosition } from "../execution.js";
import { syncTradesWithExchange } from "../sync.js";
import { getNormalizedAccountState } from "../account-state.js";
import { buildPerformanceProfile, getPerformanceProfileSummary } from "../performance-profile.js";
import { buildYesterdayLearningReport } from "../daily-report.js";
import { addPendingIntent, listPendingIntents, resolvePendingIntent, getPendingIntent } from "../pending-intents.js";
import { loadOperatorKnowledge, summarizeOperatorKnowledge } from "../operator-knowledge.js";
import { buildTradeThesis } from "../thesis-builder.js";
import { updateBeliefsFromClosedTrade, getLearnedBeliefs } from "../belief-updater.js";
import { canEmitAction, markActionEmitted } from "../action-guard.js";
import { replayApprovedIntent } from "../execution-replay.js";
import { summarizeExecutionResult } from "../execution-result.js";
import { inferExecutionPhase, deriveExchangePhase } from "../execution-state-machine.js";
import { buildExecutionReliabilitySummary } from "../execution-reliability.js";
import { listExecutionIncidents } from "../execution-incidents.js";
import { buildCompoundingContext } from "../compounding.js";
import { analyzeMarketStructure } from "../analyzers/market-structure.js";
import { analyzeVolatility } from "../analyzers/volatility.js";
import { analyzeVwapAndValue } from "../analyzers/vwap-value.js";
import { analyzeVolumeProfile } from "../analyzers/volume-profile.js";
import { analyzePerpContext } from "../analyzers/perp-context.js";
import { analyzeOrderBook } from "../analyzers/order-book.js";
import { synthesizeMarketAnalysis } from "../analyzers/market-synthesis.js";
import { summarizeSymbolAnalysis } from "../analyzers/analysis-summary.js";
import { buildTradePlanFromAnalysis } from "../analyzers/trade-plan.js";
import { analyzeMultiTimeframe } from "../analyzers/multi-timeframe.js";
import { evaluateTradeVeto } from "../analyzers/trade-veto.js";
import { updateMarketStreamSnapshot, getMarketStreamSnapshot, listMarketStreamSnapshots } from "../market-stream-state.js";
import { subscribeSymbolOrderBook, subscribeSymbolTrades, listSubscribedSymbols } from "../market-stream.js";
import { getMicrostructureSamples, listMicrostructureState } from "../microstructure-state.js";
import { analyzeMicrostructureHistory } from "../analyzers/microstructure.js";
import { getTradeStreamState, listTradeStreamState } from "../trade-stream-state.js";
import { analyzeTradeFlow } from "../analyzers/trade-flow.js";
import { analyzeOrderFlowSignals } from "../analyzers/order-flow-signals.js";
import { analyzeEntryStyle } from "../analyzers/entry-style.js";
import { buildRiskBudget } from "../risk-budget.js";
import { evaluateAutonomousSafety } from "../safety-rails.js";
import { setSymbolSafetyHold, getSymbolSafetyHold, clearSymbolSafetyHold } from "../safety-state.js";
import { reconcileExecutionLeftovers } from "../reconciliation.js";
import { buildGoLiveCheck } from "../go-live-check.js";
import { evaluateOperatorActionGate, getOperatorControls, haltTrading, resumeTrading, setCloseOnly, suspendSymbol, unsuspendSymbol } from "../operator-controls.js";
import { buildHealthSummary } from "../health-summary.js";
import { startBurnIn, stopBurnIn, summarizeBurnInState } from "../burn-in.js";

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

function getSymbolProfileBias(symbol) {
  const perfProfile = getPerformanceProfileSummary().profile;
  const stats = perfProfile?.bySymbol?.[symbol];
  if (!stats || stats.count < 2) {
    return { scoreBias: 0, sizeBias: 1, reasons: [] };
  }

  const reasons = [];
  let scoreBias = 0;
  let sizeBias = 1;

  if (stats.avgPnlPct >= 3) {
    scoreBias += 1;
    sizeBias = 1.1;
    reasons.push("symbol_profile_positive");
  } else if (stats.avgPnlPct <= -3) {
    scoreBias -= 1;
    sizeBias = 0.85;
    reasons.push("symbol_profile_negative");
  }

  return { scoreBias, sizeBias, reasons };
}

function scoreSnapshot(snapshot, extras = {}) {
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
  if (extras.candleMomentumPct != null && extras.candleMomentumPct > 0) {
    score += 1;
    reasons.push("positive_candle_momentum");
  }
  if (extras.candleMomentumPct != null && extras.candleMomentumPct < 0) {
    score -= 1;
    reasons.push("negative_candle_momentum");
  }
  if (extras.fundingTrend != null && extras.fundingTrend < 0) {
    reasons.push("recent_funding_negative");
  }
  if (extras.bookImbalance != null && extras.bookImbalance > 0.1) {
    score += 1;
    reasons.push("bid_book_support");
  }
  if (extras.bookImbalance != null && extras.bookImbalance < -0.1) {
    score -= 1;
    reasons.push("ask_book_pressure");
  }

  const symbolBias = getSymbolProfileBias(snapshot.symbol);
  score += symbolBias.scoreBias;
  reasons.push(...symbolBias.reasons);

  let setupQuality = "skip";
  if (score >= 6) setupQuality = "tradeable";
  else if (score >= 3) setupQuality = "watch";

  let sideBias = "neutral";
  if ((snapshot.funding || 0) < 0 && (snapshot.premium || 0) <= 0) sideBias = "long-bias";
  if ((snapshot.funding || 0) > 0 && (snapshot.premium || 0) >= 0) sideBias = "short-bias";
  if (extras.bookImbalance != null && extras.bookImbalance > 0.1) sideBias = "long-bias";
  if (extras.bookImbalance != null && extras.bookImbalance < -0.1) sideBias = "short-bias";

  return { score, setupQuality, sideBias, reasons, symbolBias };
}

function writeLifecycleJournal(kind, payload) {
  appendJournal({
    timestamp: new Date().toISOString(),
    type: "trade_lifecycle",
    kind,
    payload,
  });
}

function classifyOutcome(realizedPnlPct) {
  if (realizedPnlPct == null) return "unknown";
  if (realizedPnlPct >= 5) return "big_profit";
  if (realizedPnlPct > 0) return "small_profit";
  if (realizedPnlPct <= -5) return "big_loss";
  if (realizedPnlPct < 0) return "small_loss";
  return "flat";
}

function buildCloseReview(trade, matchingPosition = null) {
  const outcome = classifyOutcome(trade.realizedPnlPct);
  const why = [];

  if (trade.realizedPnlPct == null) {
    why.push("Missing realized PnL input.");
  } else if (trade.realizedPnlPct < 0) {
    why.push(`Trade closed at a loss (${trade.realizedPnlPct}%). Evaluate thesis quality, entry timing, and whether funding/book context turned against the trade.`);
  } else if (trade.realizedPnlPct > 0) {
    why.push(`Trade closed in profit (${trade.realizedPnlPct}%). Evaluate whether the thesis was correct, whether exits were efficient, and whether size should be repeated or scaled.`);
  }

  if (trade.closeReason) {
    why.push(`Close reason: ${trade.closeReason}.`);
  }

  if (matchingPosition?.liquidationPx != null) {
    why.push(`Live position context before close had liquidation price ${matchingPosition.liquidationPx}.`);
  }

  return {
    outcome,
    review: why.join(" "),
  };
}

function extractTradeLessons(trades) {
  const closed = trades.filter((trade) => trade.status === "closed");
  if (!closed.length) {
    return ["No closed trades yet. Collect more execution history before tuning hard rules."];
  }

  const buckets = {
    big_profit: [],
    small_profit: [],
    small_loss: [],
    big_loss: [],
    flat: [],
    unknown: [],
  };

  for (const trade of closed) {
    buckets[classifyOutcome(trade.realizedPnlPct)].push(trade);
  }

  const lessons = [];

  for (const [bucket, items] of Object.entries(buckets)) {
    if (!items.length || ["flat", "unknown"].includes(bucket)) continue;
    const avg = items.reduce((sum, trade) => sum + (trade.realizedPnlPct || 0), 0) / items.length;
    lessons.push(`Outcome bucket ${bucket}: ${items.length} trade(s), average PnL ${avg.toFixed(2)}%.`);
  }

  const positive = closed.filter((trade) => (trade.realizedPnlPct || 0) > 0);
  const negative = closed.filter((trade) => (trade.realizedPnlPct || 0) < 0);

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

async function buildSymbolAnalysis(symbol) {
  const context = await toolMap.get_market_context({ symbols: [symbol] });
  const snapshot = context.symbols[0] || null;
  const [candles, higherTimeframeCandles, lowerTimeframeCandles, funding, book] = await Promise.all([
    fetchCandles(symbol, config.screening.timeframe).catch(() => []),
    fetchCandles(symbol, "1h").catch(() => []),
    fetchCandles(symbol, "5m").catch(() => []),
    fetchFunding(symbol).catch(() => []),
    fetchL2Book(symbol).catch(() => null),
  ]);

  const firstCandle = candles?.[0];
  const lastCandle = candles?.[candles.length - 1];
  const candleMomentumPct = firstCandle && lastCandle
    ? ((Number(lastCandle.c) - Number(firstCandle.o)) / Number(firstCandle.o)) * 100
    : null;
  const fundingTrend = Array.isArray(funding) && funding.length
    ? Number(funding[funding.length - 1].fundingRate)
    : null;
  const bids = book?.levels?.[0] || [];
  const asks = book?.levels?.[1] || [];
  const bidSz = bids.reduce((sum, level) => sum + Number(level.sz || 0), 0);
  const askSz = asks.reduce((sum, level) => sum + Number(level.sz || 0), 0);
  const bookImbalance = (bidSz + askSz) > 0 ? (bidSz - askSz) / (bidSz + askSz) : null;

  const scored = scoreSnapshot(snapshot, { candleMomentumPct, fundingTrend, bookImbalance });
  const structure = analyzeMarketStructure(candles);
  const volatility = analyzeVolatility(candles);
  const multiTimeframe = analyzeMultiTimeframe({
    lower: lowerTimeframeCandles,
    primary: candles,
    higher: higherTimeframeCandles,
  });
  const vwapValue = analyzeVwapAndValue(candles);
  const volumeProfile = analyzeVolumeProfile(candles);
  const perpContext = analyzePerpContext({ snapshot, fundingHistory: funding });
  const orderBook = analyzeOrderBook(book);
  const microstructure = analyzeMicrostructureHistory(getMicrostructureSamples(symbol).samples);
  const tradeFlow = analyzeTradeFlow(getTradeStreamState(symbol).trades);
  const synthesis = synthesizeMarketAnalysis({ structure, volatility, vwapValue, volumeProfile, perpContext, orderBook });
  const orderFlowSignals = analyzeOrderFlowSignals({ microstructure, tradeFlow, orderBook, synthesis });
  const requestedSide = synthesis.bias === "short" ? "short" : synthesis.bias === "long" ? "long" : null;
  const tradeVeto = evaluateTradeVeto({ analysis: { structure, volatility, multiTimeframe, vwapValue, volumeProfile, perpContext, orderBook, synthesis, microstructure, tradeFlow, orderFlowSignals }, requestedSide });
  const entryStyle = analyzeEntryStyle({ analysis: { structure, volatility, multiTimeframe, vwapValue, volumeProfile, perpContext, orderBook, synthesis, microstructure, tradeFlow, orderFlowSignals, tradeVeto }, requestedSide });

  updateMarketStreamSnapshot(symbol, {
    bookImbalance,
    fundingTrend,
    candleMomentumPct,
    executionQuality: orderBook.executionQuality,
    synthesisBias: synthesis.bias,
  });

  return {
    snapshot,
    candlesCount: candles.length,
    fundingPoints: Array.isArray(funding) ? funding.length : 0,
    candleMomentumPct,
    fundingTrend,
    bookImbalance,
    scored,
    structure,
    volatility,
    multiTimeframe,
    vwapValue,
    volumeProfile,
    perpContext,
    orderBook,
    microstructure,
    synthesis,
    tradeFlow,
    orderFlowSignals,
    entryStyle,
    tradeVeto,
    streamSnapshot: getMarketStreamSnapshot(symbol),
  };
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

  async analyze_symbol({ symbol }) {
    if (!symbol) return { error: "symbol is required" };
    const upper = String(symbol).toUpperCase();
    const analysis = await buildSymbolAnalysis(upper);
    return {
      symbol: upper,
      timeframe: config.screening.timeframe,
      regime: config.screening.regime,
      summary: summarizeSymbolAnalysis(analysis),
      analysis,
    };
  },

  async subscribe_symbol_order_book({ symbol }) {
    const result = await subscribeSymbolOrderBook(symbol);
    return {
      ...result,
      subscribedSymbols: listSubscribedSymbols(),
    };
  },

  async subscribe_symbol_trades({ symbol }) {
    const result = await subscribeSymbolTrades(symbol);
    return {
      ...result,
      subscribedSymbols: listSubscribedSymbols(),
    };
  },

  async get_trade_flow_state({ symbol } = {}) {
    if (symbol) {
      const upper = String(symbol).toUpperCase();
      const state = getTradeStreamState(upper);
      return {
        symbol: upper,
        trades: state.trades,
        summary: analyzeTradeFlow(state.trades),
      };
    }
    const state = listTradeStreamState();
    const summaries = Object.fromEntries(
      Object.entries(state.symbols || {}).map(([sym, payload]) => [sym, analyzeTradeFlow(payload.trades || [])]),
    );
    return { state, summaries };
  },

  async get_microstructure_state({ symbol } = {}) {
    if (symbol) {
      const upper = String(symbol).toUpperCase();
      const state = getMicrostructureSamples(upper);
      return {
        symbol: upper,
        samples: state.samples,
        summary: analyzeMicrostructureHistory(state.samples),
      };
    }
    const state = listMicrostructureState();
    const summaries = Object.fromEntries(
      Object.entries(state.symbols || {}).map(([sym, payload]) => [sym, analyzeMicrostructureHistory(payload.samples || [])]),
    );
    return { state, summaries };
  },

  async get_market_stream_state() {
    return {
      subscribedSymbols: listSubscribedSymbols(),
      snapshots: listMarketStreamSnapshots(),
    };
  },

  async list_account_state() {
    const normalized = await getNormalizedAccountState();

    return {
      source: "hyperliquid",
      dryRun: process.env.DRY_RUN === "true",
      accountAddress: normalized.user || null,
      missingAccountAddress: !normalized.user,
      risk: config.risk,
      marginSummary: normalized.marginSummary,
      crossMaintenanceMarginUsed: normalized.crossMaintenanceMarginUsed,
      withdrawable: normalized.withdrawable,
      positions: normalized.positions,
      raw: normalized.raw,
    };
  },

  async rank_trade_setups({ symbols } = {}) {
    const context = await toolMap.get_market_context({ symbols });
    const candidates = await Promise.all(context.symbols.map(async (snapshot) => {
      const analysis = await buildSymbolAnalysis(snapshot.symbol);

      const liveFlowPenalty = analysis.tradeVeto.cautions?.length ? analysis.tradeVeto.cautions.length * 0.75 : 0;
      const microstructurePenalty = analysis.microstructure?.regime === "thin" ? 1.25 : 0;
      const tradeFlowBoost = analysis.tradeFlow?.deltaBias === "buy_pressure" && analysis.synthesis.bias === "long"
        ? 0.75
        : analysis.tradeFlow?.deltaBias === "sell_pressure" && analysis.synthesis.bias === "short"
          ? 0.75
          : 0;
      const orderFlowImpact = Number(analysis.orderFlowSignals?.confidenceImpact || 0) * 10;
      const entryStyleImpact = analysis.entryStyle?.style === "breakout"
        ? 1.25
        : analysis.entryStyle?.style === "pullback"
          ? 0.85
          : analysis.entryStyle?.style === "fade"
            ? 0.3
            : -1.5;
      const finalScore = Number((analysis.scored.score + analysis.synthesis.longScore - analysis.synthesis.shortScore + tradeFlowBoost + orderFlowImpact + entryStyleImpact - liveFlowPenalty - microstructurePenalty).toFixed(2));

      return {
        symbol: snapshot.symbol,
        verdict: !analysis.tradeVeto.allowed || analysis.entryStyle?.style === "no_trade" ? "skip" : analysis.synthesis.bias === "long" || analysis.synthesis.bias === "short" ? "tradeable" : analysis.synthesis.bias.startsWith("watch") ? "watch" : analysis.scored.setupQuality,
        sideBias: analysis.synthesis.bias,
        score: finalScore,
        reasons: [...analysis.scored.reasons, ...analysis.synthesis.reasons, ...(analysis.orderFlowSignals?.reasons || []), ...(analysis.tradeVeto.cautions || [])],
        riskFlags: [...(analysis.synthesis.riskFlags || []), ...(analysis.tradeVeto.vetoes || [])],
        tradeVeto: analysis.tradeVeto,
        entryStyle: analysis.entryStyle,
        confidence: analysis.synthesis.confidence,
        executionQuality: analysis.synthesis.executionQuality,
        location: analysis.synthesis.location,
        crowding: analysis.synthesis.crowding,
        microstructure: analysis.microstructure,
        tradeFlow: analysis.tradeFlow,
        orderFlowSignals: analysis.orderFlowSignals,
        funding: snapshot.funding,
        openInterest: snapshot.openInterest,
        dayNtlVlm: snapshot.dayNtlVlm,
        premium: snapshot.premium,
        candleMomentumPct: analysis.candleMomentumPct,
        fundingTrend: analysis.fundingTrend,
        bookImbalance: analysis.bookImbalance,
        analyzers: analysis,
        summary: summarizeSymbolAnalysis(analysis),
        note: "Helix ranking now uses multi-factor perp analysis over candles, funding, OI context, value, L2 book data, rolling microstructure, native trade flow, and explicit entry-style policy.",
      };
    }));

    return {
      source: "hyperliquid",
      regime: config.screening.regime,
      timeframe: config.screening.timeframe,
      candidates: candidates.sort((a, b) => b.score - a.score),
    };
  },

  async propose_trade({ symbol, side }) {
    const context = await toolMap.get_market_context({ symbols: [symbol] });
    const snapshot = context.symbols[0] || null;
    const analysis = await buildSymbolAnalysis(symbol);
    const scored = analysis.scored;
    const synthesis = analysis.synthesis;

    const builtThesis = buildTradeThesis({ symbol, side, snapshot, scored: { ...scored, ...analysis, multiTimeframe: analysis.multiTimeframe } });
    const tradePlan = buildTradePlanFromAnalysis({
      snapshot,
      analysis,
      defaultStopLossPct: config.execution.stopLossPct,
      defaultTakeProfitPct: config.execution.takeProfitPct,
      side,
    });

    const liveAccount = await getNormalizedAccountState().catch(() => null);
    const compounding = buildCompoundingContext({ limit: 200, account: liveAccount });
    const synthesisSizeBias = synthesis.bias === "no_trade" ? 0.5 : synthesis.confidence >= 0.7 ? 1.1 : 1;
    const entryStyleSizeBias = analysis.entryStyle?.style === "breakout"
      ? 1.1
      : analysis.entryStyle?.style === "pullback"
        ? 1
        : analysis.entryStyle?.style === "fade"
          ? 0.8
          : 0.5;
    const microstructureSizeBias = analysis.microstructure?.regime === "thin" ? 0.75 : 1;
    const cautionSizeBias = analysis.tradeVeto?.cautions?.length ? Math.max(0.6, 1 - (analysis.tradeVeto.cautions.length * 0.1)) : 1;
    const tradeFlowSizeBias = analysis.tradeFlow?.deltaBias === "buy_pressure" && side === "long"
      ? 1.05
      : analysis.tradeFlow?.deltaBias === "sell_pressure" && side === "short"
        ? 1.05
        : analysis.tradeFlow?.deltaBias === "balanced"
          ? 0.95
          : 1;
    const orderFlowSizeBias = analysis.orderFlowSignals?.signalBias === "avoid"
      ? 0.7
      : analysis.orderFlowSignals?.signalBias === "caution"
        ? 0.85
        : analysis.orderFlowSignals?.signalBias === "long_confirm" && side === "long"
          ? 1.05
          : analysis.orderFlowSignals?.signalBias === "short_confirm" && side === "short"
            ? 1.05
            : 1;
    const proposedSizeUsd = Number((config.execution.defaultPositionSizeUsd * (builtThesis.suggestedSizeBias || 1) * (compounding.sizeMultiplier || 1) * synthesisSizeBias * entryStyleSizeBias * microstructureSizeBias * cautionSizeBias * tradeFlowSizeBias * orderFlowSizeBias).toFixed(2));
    const riskBudget = buildRiskBudget({ account: liveAccount, proposedSizeUsd });

    return {
      symbol,
      side,
      mode: process.env.DRY_RUN === "true" ? "dry-run" : "live",
      tradeVeto: analysis.tradeVeto,
      entryStyle: analysis.entryStyle,
      thesis: builtThesis.thesis,
      analysisSummary: summarizeSymbolAnalysis(analysis),
      operatorKnowledge: builtThesis.operatorKnowledge,
      symbolProfile: builtThesis.symbolProfile,
      learnedSymbolBelief: builtThesis.learnedSymbolBelief,
      invalidation: tradePlan.invalidation,
      target: tradePlan.target,
      takeProfit: tradePlan.takeProfitPct,
      stopLoss: tradePlan.stopLossPct,
      trailingStop: config.execution.trailingStopPct,
      executionNotes: tradePlan.executionNotes,
      sizeUsd: analysis.tradeVeto.allowed ? (riskBudget.cappedSizeUsd ?? proposedSizeUsd) : 0,
      proposedSizeUsd,
      confidenceAdjustment: builtThesis.confidenceAdjustment,
      compounding,
      riskBudget,
      snapshot,
      scored,
      analyzers: analysis,
    };
  },

  async place_order({ symbol, side, sizeUsd, thesis, stopLossPct, takeProfitPct, leverage = 1 }) {
    const operatorGate = evaluateOperatorActionGate({ actionType: "place_order", symbol });
    if (!operatorGate.allowed) {
      return {
        placed: false,
        blocked: true,
        reason: operatorGate.reason,
        controls: operatorGate.controls,
      };
    }

    const proposal = await toolMap.propose_trade({ symbol, side });
    const execution = await openPerpPosition({
      symbol,
      side,
      sizeUsd: sizeUsd ?? proposal.sizeUsd,
      leverage,
      asset: proposal.snapshot?.assetIndex,
      price: proposal.snapshot?.markPx || proposal.snapshot?.midPx || 1,
      size: sizeUsd ?? proposal.sizeUsd,
      tif: "Ioc",
    });
    if (!execution.success) {
      return execution;
    }
    const liveStatuses = execution?.execution?.result?.response?.data?.statuses || [];
    const firstStatus = liveStatuses[0] || null;
    const exchangeMeta = firstStatus?.resting
      ? { oid: firstStatus.resting.oid, cloid: firstStatus.resting.cloid || null, status: "resting" }
      : firstStatus?.filled
        ? { oid: firstStatus.filled.oid, cloid: firstStatus.filled.cloid || null, status: "filled", avgPx: firstStatus.filled.avgPx }
        : null;

    const verification = summarizeExecutionResult(execution?.execution?.result);
    const requestedOpenSize = Number(sizeUsd ?? proposal.sizeUsd ?? 0) || null;
    const trade = createTradeRecord({
      symbol,
      side,
      sizeUsd: sizeUsd ?? proposal.sizeUsd,
      thesis: thesis || proposal.thesis,
      stopLossPct: stopLossPct ?? proposal.stopLoss,
      takeProfitPct: takeProfitPct ?? proposal.takeProfit,
      snapshot: proposal.snapshot,
      exchange: exchangeMeta,
    });
    updateTradeExecutionState(trade.tradeId, {
      lastIntentAction: "open",
      lastOpenVerification: verification,
      lastOpenAt: new Date().toISOString(),
      lastOpenOutcome: verification.executionLabel,
      lastRequestedOpenSize: requestedOpenSize,
      remainingOpenSize: requestedOpenSize != null ? Math.max(0, requestedOpenSize - (verification.totalFilledSize || 0)) : null,
    });
    updateTradeLifecycle(trade.tradeId, {
      lifecyclePhase: inferExecutionPhase({
        action: "open",
        verification,
        hasOpenOrder: verification.restingCount > 0,
        remainingSize: requestedOpenSize != null ? Math.max(0, requestedOpenSize - (verification.totalFilledSize || 0)) : null,
        tradeStatus: trade.status,
      }),
      lastExchangeState: verification.executionLabel,
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
    const trades = listRecentTrades(100);
    const existing = trades.find((trade) => trade.tradeId === tradeId);
    if (!existing) return { error: `Trade not found: ${tradeId}` };

    const account = await getNormalizedAccountState().catch(() => null);
    const matchingPosition = account?.positions?.find((position) => position.coin === existing.symbol);
    const { reducePerpPosition } = await import("../execution.js");
    const execution = await reducePerpPosition({
      symbol: existing.symbol,
      side: existing.side,
      reducePct,
      size: matchingPosition ? Math.abs(Number(matchingPosition.szi || 0)) * ((reducePct || 0) / 100) : null,
      livePosition: matchingPosition || null,
    });
    if (!execution.success) {
      return execution;
    }

    const verification = summarizeExecutionResult(execution?.execution?.result);
    const requestedReduceSize = matchingPosition ? Math.abs(Number(matchingPosition.szi || 0)) * ((reducePct || 0) / 100) : null;
    const remainingReduceSize = requestedReduceSize != null ? Math.max(0, requestedReduceSize - (verification.totalFilledSize || 0)) : null;
    updateTradeExecutionState(tradeId, {
      lastIntentAction: "reduce",
      lastReduceVerification: verification,
      lastReduceAt: new Date().toISOString(),
      lastReduceOutcome: verification.executionLabel,
      lastReduceFilledSize: verification.totalFilledSize,
      lastReduceAvgFillPx: verification.avgFillPx,
      lastRequestedReduceSize: requestedReduceSize,
      remainingReduceSize,
    });
    updateTradeLifecycle(tradeId, {
      lifecyclePhase: inferExecutionPhase({
        action: "reduce",
        verification,
        hasOpenOrder: verification.restingCount > 0,
        remainingSize: remainingReduceSize,
        tradeStatus: existing.status,
      }),
      lastExchangeState: verification.executionLabel,
    });
    const trade = reduceTradeRecord(tradeId, { reducePct, reason });
    writeLifecycleJournal("reduce_position", { tradeId, reducePct, reason, execution, matchingPosition, verification });
    return {
      reduced: true,
      trade,
      execution,
      matchingPosition,
      verification,
    };
  },

  async close_position({ tradeId, reason, exitPrice, realizedPnlPct }) {
    const trades = listRecentTrades(100);
    const existing = trades.find((trade) => trade.tradeId === tradeId);
    if (!existing) return { error: `Trade not found: ${tradeId}` };

    const account = await getNormalizedAccountState().catch(() => null);
    const matchingPosition = account?.positions?.find((position) => position.coin === existing.symbol);
    if (!matchingPosition && process.env.HELIX_ENABLE_LIVE_EXECUTION === "true") {
      return { error: `No live position found for symbol ${existing.symbol}. Refusing fake close.` };
    }

    const execution = await closePerpPosition({ trade: existing, livePosition: matchingPosition || null });
    if (!execution.success) {
      return execution;
    }
    const verification = summarizeExecutionResult(execution?.execution?.result);
    if (execution?.execution?.result) {
      updateTradeExchange(tradeId, { closeResult: execution.execution.result, closeVerification: verification });
    }
    const requestedCloseSize = matchingPosition ? Math.abs(Number(matchingPosition.szi || 0)) : null;
    const remainingCloseSize = requestedCloseSize != null ? Math.max(0, requestedCloseSize - (verification.totalFilledSize || 0)) : null;
    updateTradeExecutionState(tradeId, {
      lastIntentAction: "close",
      lastCloseVerification: verification,
      lastCloseAt: new Date().toISOString(),
      lastCloseOutcome: verification.executionLabel,
      lastCloseFilledSize: verification.totalFilledSize,
      lastCloseAvgFillPx: verification.avgFillPx,
      lastRequestedCloseSize: requestedCloseSize,
      remainingCloseSize,
    });
    updateTradeLifecycle(tradeId, {
      lifecyclePhase: inferExecutionPhase({
        action: "close",
        verification,
        hasOpenOrder: verification.restingCount > 0,
        remainingSize: remainingCloseSize,
        tradeStatus: remainingCloseSize > 0 ? existing.status : "closed",
      }),
      lastExchangeState: verification.executionLabel,
    });
    const trade = closeTradeRecord(tradeId, {
      reason,
      exitPrice,
      realizedPnlPct,
      exchange: execution?.execution?.result ? { closeResult: execution.execution.result } : null,
    });
    const closeReview = buildCloseReview(trade, matchingPosition);
    const learnedBeliefs = updateBeliefsFromClosedTrade(trade);
    appendJournal({
      timestamp: new Date().toISOString(),
      type: "close_review",
      tradeId,
      symbol: trade.symbol,
      side: trade.side,
      realizedPnlPct: trade.realizedPnlPct,
      outcome: closeReview.outcome,
      review: closeReview.review,
      reason: trade.closeReason || null,
    });
    const profile = buildPerformanceProfile();
    writeLifecycleJournal("close_position", { tradeId, reason, exitPrice, realizedPnlPct, execution, matchingPosition, closeReview, profile, learnedBeliefs, verification });
    return {
      closed: true,
      trade,
      execution,
      matchingPosition,
      verification,
    };
  },

  async get_operator_knowledge() {
    return loadOperatorKnowledge();
  },

  async manage_open_positions() {
    const account = await getNormalizedAccountState();
    const actions = [];

    for (const position of account.positions || []) {
      let suggestedAction = "hold";
      let reason = "No risk trigger hit.";
      let intent = null;
      let executed = false;
      let execution = null;

      const learnedBelief = getLearnedBeliefs()?.symbols?.[position.coin] || null;
      const recentTrade = listRecentTrades(200).find((trade) => trade.symbol === position.coin);
      const recentExecutionOutcome = recentTrade?.executionState?.lastReduceOutcome || recentTrade?.executionState?.lastCloseOutcome || null;
      const executionReliability = buildExecutionReliabilitySummary(300).bySymbol[position.coin] || null;
      const safetyHold = getSymbolSafetyHold(position.coin);

      const operatorGate = evaluateOperatorActionGate({ actionType: "manage_open_positions", symbol: position.coin });

      if (!operatorGate.allowed && operatorGate.reason?.startsWith("symbol_suspended:")) {
        suggestedAction = "hold";
        reason = `Operator suspended ${position.coin}.`;
      } else if (safetyHold?.active) {
        suggestedAction = "hold";
        reason = `Safety hold active for ${position.coin}: ${safetyHold.reason || "no reason recorded"}.`;
      } else if ((position.returnOnEquity || 0) <= -config.execution.stopLossPct) {
        suggestedAction = "close";
        reason = `ROE ${position.returnOnEquity}% breached stop threshold.`;
        intent = {
          type: "close_position",
          symbol: position.coin,
          side: position.side,
          reduceOnly: true,
          size: Math.abs(position.szi || 0),
        };
      } else if ((position.returnOnEquity || 0) >= config.execution.takeProfitPct) {
        suggestedAction = "reduce";
        reason = `ROE ${position.returnOnEquity}% reached take-profit threshold.`;
        intent = {
          type: "reduce_position",
          symbol: position.coin,
          side: position.side,
          reduceOnly: true,
          reducePct: 50,
          size: Math.abs(position.szi || 0) * 0.5,
        };
      } else if (executionReliability && executionReliability.total >= 2 && executionReliability.reliabilityScore < -0.25) {
        suggestedAction = "hold";
        reason = `Execution reliability for ${position.coin} is poor (${executionReliability.reliabilityScore}), so Helix is throttling action.`;
      } else if (executionReliability && executionReliability.total >= 3 && executionReliability.ioc_cancel >= 2) {
        suggestedAction = "hold";
        reason = `Recent IOC cancel streak on ${position.coin} suggests poor execution conditions, so Helix is staying patient.`;
      } else if (["ioc_cancel", "error"].includes(recentExecutionOutcome)) {
        suggestedAction = "hold";
        reason = `Recent execution quality for ${position.coin} was weak (${recentExecutionOutcome}), so Helix is avoiding another immediate action.`;
      } else if (learnedBelief && (learnedBelief.avgPnlPct || 0) <= -4 && (learnedBelief.losses || 0) >= 2) {
        suggestedAction = "reduce";
        reason = `Belief layer is weak for ${position.coin}: avg pnl ${learnedBelief.avgPnlPct} with ${learnedBelief.losses} losses.`;
        intent = {
          type: "reduce_position",
          symbol: position.coin,
          side: position.side,
          reduceOnly: true,
          reducePct: 25,
          size: Math.abs(position.szi || 0) * 0.25,
        };
      }

      const actionKey = `${position.coin}:${suggestedAction}`;

      if (intent && !canEmitAction(actionKey)) {
        execution = {
          suppressed: true,
          note: `Suppressed duplicate action for ${actionKey} during cooldown window.`,
        };
        intent = null;
      }

      if (intent && getOperatorControls().halted) {
        execution = {
          blocked: true,
          note: "Global operator halt is active.",
        };
        intent = null;
      }

      if (config.execution.mode === "approval" && intent) {
        const linkedTrade = recentTrade?.status === "open" ? recentTrade : null;
        const pending = addPendingIntent({ source: "manage_open_positions", coin: position.coin, side: position.side, intent, reason, beliefContext: learnedBelief, tradeId: linkedTrade?.tradeId || null });
        markActionEmitted(actionKey);
        execution = { requiresApproval: true, intent, pending };
      }

      if (config.execution.mode === "autonomous" && intent) {
        const safety = evaluateAutonomousSafety({
          account,
          symbol: position.coin,
          executionReliability,
        });

        if (!safety.allowAutonomous) {
          setSymbolSafetyHold(position.coin, {
            active: true,
            reason: safety.reasons.join(", "),
            safety,
          });
          execution = {
            attempted: false,
            blocked: true,
            note: `Autonomous action blocked by safety rails: ${safety.reasons.join(", ")}`,
            safety,
            intent,
          };
        } else {
          clearSymbolSafetyHold(position.coin);
          markActionEmitted(actionKey);
          execution = {
            attempted: false,
            note: "Autonomous manager execution for reduce/close is not fully implemented yet. Intent generated and held.",
            intent,
            safety,
          };
        }
      }

      actions.push({
        coin: position.coin,
        side: position.side,
        returnOnEquity: position.returnOnEquity,
        leverage: position.leverage,
        suggestedAction,
        reason,
        intent,
        executed,
        execution,
      });
    }

    return {
      source: "helix-manager",
      mode: config.execution.mode,
      positions: account.positions,
      actions,
    };
  },

  async sync_exchange_state({ limit = 50 } = {}) {
    return await syncTradesWithExchange(limit);
  },

  async list_pending_intents() {
    const intents = listPendingIntents();
    return {
      intents,
      summary: {
        pending: intents.filter((item) => item.status === "pending").length,
        approved: intents.filter((item) => item.status === "approved").length,
        rejected: intents.filter((item) => item.status === "rejected").length,
        expired: intents.filter((item) => item.status === "expired").length,
      },
    };
  },

  async resolve_pending_intent({ id, decision }) {
    const current = getPendingIntent(id);
    if (!current) return { error: `Pending intent not found: ${id}` };

    if (current.status !== "pending") {
      return { error: `Pending intent ${id} is already ${current.status}.`, current };
    }

    if (decision === "approved") {
      const replay = await replayApprovedIntent(current);
      const finalDecision = replay?.success ? decision : "rejected";
      const reconciliation = await reconcileExecutionLeftovers(200).catch(() => null);
      const resolved = resolvePendingIntent(id, finalDecision, { replay, reconciliation, requestedDecision: decision });
      return { resolved, replay, reconciliation };
    }

    const resolved = resolvePendingIntent(id, decision);
    return { resolved };
  },

  async get_operator_controls() {
    return getOperatorControls();
  },

  async halt_trading({ reason } = {}) {
    return haltTrading(reason || "operator_halt");
  },

  async resume_trading() {
    return resumeTrading();
  },

  async set_close_only_mode({ enabled = true, reason } = {}) {
    return setCloseOnly(enabled, reason || null);
  },

  async suspend_symbol({ symbol, reason } = {}) {
    if (!symbol) return { error: "symbol is required" };
    return suspendSymbol(symbol, reason || "operator_suspend");
  },

  async unsuspend_symbol({ symbol } = {}) {
    if (!symbol) return { error: "symbol is required" };
    return unsuspendSymbol(symbol);
  },

  async get_execution_audit({ limit = 200 } = {}) {
    const reliability = buildExecutionReliabilitySummary(limit);
    const trades = listRecentTrades(limit);
    const phases = trades.reduce((acc, trade) => {
      const phase = trade.lifecyclePhase || "unknown";
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    }, {});
    return {
      tradesInspected: trades.length,
      phases,
      reliability,
      recentIncidents: listExecutionIncidents(Math.min(50, limit)),
    };
  },

  async start_burn_in({ mode = "paper", note = null } = {}) {
    return startBurnIn({ mode, note });
  },

  async stop_burn_in({ note = null } = {}) {
    return stopBurnIn({ note });
  },

  async get_burn_in_status() {
    return summarizeBurnInState();
  },

  async run_operator_drill({ symbol = "BTC" } = {}) {
    const upper = String(symbol || "BTC").toUpperCase();
    const controlsBefore = getOperatorControls();
    const suspended = suspendSymbol(upper, "operator_drill");
    const unsuspended = unsuspendSymbol(upper);
    return {
      controlsBefore,
      haltGate: evaluateOperatorActionGate({ actionType: "place_order", symbol: upper }),
      suspended,
      unsuspended,
      reconciliation: await reconcileExecutionLeftovers(50).catch((error) => ({ error: error.message })),
      health: await buildHealthSummary({ limit: 50 }).catch((error) => ({ error: error.message })),
      executionAudit: {
        reliability: buildExecutionReliabilitySummary(50),
        recentIncidents: listExecutionIncidents(20),
      },
      burnIn: summarizeBurnInState(),
    };
  },

  async build_go_live_check() {
    return await buildGoLiveCheck();
  },

  async build_health_summary({ limit = 100 } = {}) {
    return buildHealthSummary({ limit });
  },

  async build_yesterday_report() {
    return buildYesterdayLearningReport();
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
    const sync = await syncTradesWithExchange(limit).catch(() => null);
    const notes = readJournal(limit);
    const trades = listRecentTrades(limit);
    const perfProfile = getPerformanceProfileSummary();
    const closed = trades.filter((trade) => trade.status === "closed");
    const open = trades.filter((trade) => trade.status === "open");
    const avgClosedPnl = closed.length
      ? closed.reduce((sum, trade) => sum + (trade.realizedPnlPct || 0), 0) / closed.length
      : null;

    const executionSummary = trades.reduce((acc, trade) => {
      const outcome = trade.executionState?.lastCloseOutcome || trade.executionState?.lastReduceOutcome || null;
      if (!outcome) return acc;
      acc[outcome] = (acc[outcome] || 0) + 1;
      return acc;
    }, {});

    const liveAccount = await getNormalizedAccountState().catch(() => null);
    const compounding = buildCompoundingContext({ limit: 200, account: liveAccount });
    const reconciliation = await reconcileExecutionLeftovers(200).catch(() => null);

    const safetyHolds = Array.from(new Map(
      trades
        .map((trade) => trade.symbol)
        .filter(Boolean)
        .map((symbol) => [symbol, { symbol, hold: getSymbolSafetyHold(symbol) }])
    ).values()).filter((item) => item.hold?.active);

    return {
      count: notes.length,
      notes,
      recentTrades: trades,
      sync,
      liveAccount,
      executionSummary,
      reconciliation,
      safetyHolds,
      lessons: {
        openTrades: open.length,
        closedTrades: closed.length,
        avgClosedPnlPct: avgClosedPnl,
        extracted: extractTradeLessons(trades),
        adaptiveProfile: perfProfile.profile,
        adaptiveSummary: perfProfile.summaryLines,
        learnedBeliefs: getLearnedBeliefs(),
        operatorKnowledge: summarizeOperatorKnowledge(5),
        topBeliefWarnings: Object.entries(getLearnedBeliefs()?.symbols || {})
          .filter(([, value]) => (value?.avgPnlPct || 0) < 0)
          .sort((a, b) => (a[1].avgPnlPct || 0) - (b[1].avgPnlPct || 0))
          .slice(0, 5),
        summary: closed.length
          ? `Recent closed trades average ${avgClosedPnl?.toFixed(2)}% PnL across ${closed.length} trades.`
          : "No closed trades yet. Focus on collecting more execution history.",
        executionQualitySummary: executionSummary,
        compounding,
      },
      implementationStatus: {
        realReduceOnlyCloseFromLivePosition: false,
        symbolAssetMappingForLiveClose: true,
        managementPromptUsesActualLivePositions: true,
        strongerLessonsFromRealizedPnlAndExchangeState: true,
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
