import { evaluateThesisBreak } from "./thesis-break-policy.js";

function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function evaluatePositionManagement({ trade = null, livePosition = null, analysis = null } = {}) {
  if (!trade || !livePosition) {
    return { action: "hold", reason: "missing_trade_or_live_position" };
  }

  const roe = Number(livePosition.returnOnEquity || 0);
  const unrealizedPnl = Number(livePosition.unrealizedPnl || 0);
  const executionState = trade.executionState || {};
  const entryStyle = executionState.executionTactics?.orderStyle || "unknown";
  const lastExchangeState = trade.lastExchangeState || executionState.exchangeState || "unknown";
  const reductions = Array.isArray(trade.reductions) ? trade.reductions.length : 0;

  const thesisBreak = evaluateThesisBreak({ trade, analysis, livePosition });

  let action = "hold";
  let reducePct = 0;
  let reason = "position_still_valid";

  if (thesisBreak.broken && thesisBreak.confidence >= 0.7) {
    action = "close";
    reason = `thesis_break_hard:${thesisBreak.reason}`;
  } else if (thesisBreak.broken) {
    action = "reduce";
    reducePct = 50;
    reason = `thesis_break_trim:${thesisBreak.reason}`;
  } else if (lastExchangeState === "partial_follow_up_needed") {
    action = "reduce";
    reducePct = 50;
    reason = "partial_fill_follow_up_risk_trim";
  } else if (roe <= -8 || unrealizedPnl <= -Math.abs(Number(trade.sizeUsd || 0)) * 0.04) {
    action = "close";
    reason = "hard_loss_exit";
  } else if (roe >= 12 && reductions === 0) {
    action = "reduce";
    reducePct = 50;
    reason = "first_scale_out_lock_profit";
  } else if (roe >= 20 && reductions <= 1) {
    action = "reduce";
    reducePct = 25;
    reason = "second_scale_out_trend_extension";
  } else if (entryStyle === "ioc_limit" && roe < -3) {
    action = "reduce";
    reducePct = 25;
    reason = "failed_breakout_risk_trim";
  }

  return {
    tradeId: trade.tradeId,
    symbol: trade.symbol,
    action,
    reducePct,
    reason,
    roe: round(roe, 4),
    unrealizedPnl: round(unrealizedPnl, 4),
    thesisBreak,
  };
}

export function evaluateOpenPositions({ trades = [], positions = [], analysesBySymbol = {} } = {}) {
  const positionsByCoin = new Map((positions || []).map((position) => [position.coin, position]));
  return (trades || [])
    .filter((trade) => trade.status === "open")
    .map((trade) => evaluatePositionManagement({
      trade,
      livePosition: positionsByCoin.get(trade.symbol) || null,
      analysis: analysesBySymbol?.[trade.symbol] || null,
    }));
}
