import { getNormalizedAccountState } from "./account-state.js";
import { openPerpPosition, closePerpPosition, reducePerpPosition } from "./execution.js";
import { listRecentTrades, getTradeById } from "./state.js";
import { summarizeExecutionResult } from "./execution-result.js";
import { evaluateOperatorActionGate } from "./operator-controls.js";
import { validateReplayableIntent } from "./replay-guards.js";

function findOpenTradeBySymbol(symbol) {
  return listRecentTrades(500).find((trade) => trade.symbol === symbol && trade.status === "open") || null;
}

function buildReplayBlock(error, extra = {}) {
  return {
    success: false,
    blocked: true,
    error,
    ...extra,
  };
}

export async function replayApprovedIntent(intent) {
  const replayable = validateReplayableIntent(intent);
  if (!replayable.ok) {
    return buildReplayBlock(replayable.error, replayable.expiresAt ? { expiresAt: replayable.expiresAt } : {});
  }

  const operatorGate = evaluateOperatorActionGate({ actionType: intent.intent.type, symbol: intent.intent.symbol });
  if (!operatorGate.allowed && intent.intent.type === "open_position") {
    return buildReplayBlock(`Operator gate blocked replay: ${operatorGate.reason}`, { controls: operatorGate.controls });
  }

  const account = await getNormalizedAccountState().catch(() => null);
  const livePosition = account?.positions?.find((position) => position.coin === intent.intent.symbol) || null;

  if (intent.intent.type === "reduce_position") {
    if (!livePosition) {
      return buildReplayBlock(`No live position found for ${intent.intent.symbol} during reduce replay.`);
    }

    const replay = await reducePerpPosition({
      symbol: intent.intent.symbol,
      side: intent.intent.side,
      reducePct: intent.intent.reducePct,
      size: intent.intent.size,
      livePosition,
    });
    return {
      ...replay,
      verification: summarizeExecutionResult(replay?.execution?.result),
    };
  }

  if (intent.intent.type === "close_position") {
    const trade = intent.tradeId ? getTradeById(intent.tradeId) : findOpenTradeBySymbol(intent.intent.symbol);
    if (!trade || trade.status !== "open") {
      return buildReplayBlock(`No open tracked trade found for ${intent.intent.symbol}.`, { tradeId: intent.tradeId || null });
    }
    if (!livePosition) {
      return buildReplayBlock(`No live position found for ${intent.intent.symbol} during close replay.`, { tradeId: trade.tradeId });
    }
    const replay = await closePerpPosition({ trade, livePosition });
    return {
      ...replay,
      verification: summarizeExecutionResult(replay?.execution?.result),
    };
  }

  if (intent.intent.type === "open_position") {
    const existingOpenTrade = findOpenTradeBySymbol(intent.intent.symbol);
    if (existingOpenTrade) {
      return buildReplayBlock(`Open trade already exists for ${intent.intent.symbol}.`, { tradeId: existingOpenTrade.tradeId });
    }

    const replay = await openPerpPosition(intent.intent);
    return {
      ...replay,
      verification: summarizeExecutionResult(replay?.execution?.result),
    };
  }

  return buildReplayBlock(`Unsupported intent type: ${intent.intent.type}`);
}
