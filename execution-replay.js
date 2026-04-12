import { getNormalizedAccountState } from "./account-state.js";
import { openPerpPosition, closePerpPosition, reducePerpPosition } from "./execution.js";
import { listRecentTrades, getTradeById } from "./state.js";
import { summarizeExecutionResult } from "./execution-result.js";
import { evaluateOperatorActionGate } from "./operator-controls.js";
import { validateReplayableIntent } from "./replay-guards.js";
import { classifyReplay } from "./replay-policy.js";
import { markReplayAttempt } from "./pending-intents.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { recordBurnInEvent } from "./burn-in.js";

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

function finalizeReplay(replay, replayPolicy) {
  const verification = summarizeExecutionResult(replay?.execution?.result);
  recordBurnInEvent({
    successfulExecution: Boolean(replay?.success),
    blockedExecution: !replay?.success,
    iocCancelEvent: verification.executionLabel === "ioc_cancel",
    errorEvent: verification.executionLabel === "error",
  });
  return {
    ...replay,
    verification,
    replayPolicy,
  };
}

export async function replayApprovedIntent(intent) {
  const replayable = validateReplayableIntent(intent);
  if (!replayable.ok) {
    recordExecutionIncident({ kind: "replay_blocked_guard", intentId: intent?.id || null, reason: replayable.error });
    recordBurnInEvent({ blockedExecution: true, severeIncident: true, note: `Replay blocked by guard: ${replayable.error}` });
    return buildReplayBlock(replayable.error, replayable.expiresAt ? { expiresAt: replayable.expiresAt } : {});
  }

  const replayPolicy = classifyReplay(intent);
  if (replayPolicy.decision !== "allow") {
    recordExecutionIncident({ kind: "replay_blocked_policy", intentId: intent?.id || null, reason: replayPolicy.reason, retryClass: replayPolicy.retryClass });
    recordBurnInEvent({ blockedExecution: true, severeIncident: replayPolicy.retryClass === "never", note: `Replay blocked by policy: ${replayPolicy.reason}` });
    return buildReplayBlock(`Replay policy blocked intent: ${replayPolicy.reason}`, { replayPolicy });
  }

  markReplayAttempt(intent.id, replayPolicy);

  const operatorGate = evaluateOperatorActionGate({ actionType: intent.intent.type, symbol: intent.intent.symbol });
  if (!operatorGate.allowed && intent.intent.type === "open_position") {
    recordExecutionIncident({ kind: "replay_blocked_operator_gate", intentId: intent.id, symbol: intent.intent.symbol, reason: operatorGate.reason });
    recordBurnInEvent({ blockedExecution: true, severeIncident: true, note: `Replay blocked by operator gate: ${operatorGate.reason}` });
    return buildReplayBlock(`Operator gate blocked replay: ${operatorGate.reason}`, { controls: operatorGate.controls, replayPolicy });
  }

  const account = await getNormalizedAccountState().catch(() => null);
  const livePosition = account?.positions?.find((position) => position.coin === intent.intent.symbol) || null;

  if (intent.intent.type === "reduce_position") {
    if (!livePosition) {
      recordExecutionIncident({ kind: "replay_blocked_missing_live_position", intentId: intent.id, symbol: intent.intent.symbol, action: "reduce" });
      recordBurnInEvent({ blockedExecution: true, driftEvent: true, note: `Reduce replay blocked, missing live position for ${intent.intent.symbol}` });
      return buildReplayBlock(`No live position found for ${intent.intent.symbol} during reduce replay.`, { replayPolicy });
    }

    const replay = await reducePerpPosition({
      symbol: intent.intent.symbol,
      side: intent.intent.side,
      reducePct: intent.intent.reducePct,
      size: intent.intent.size,
      livePosition,
    });
    return finalizeReplay(replay, replayPolicy);
  }

  if (intent.intent.type === "close_position") {
    const trade = intent.tradeId ? getTradeById(intent.tradeId) : findOpenTradeBySymbol(intent.intent.symbol);
    if (!trade || trade.status !== "open") {
      recordExecutionIncident({ kind: "replay_blocked_missing_open_trade", intentId: intent.id, symbol: intent.intent.symbol, action: "close" });
      recordBurnInEvent({ blockedExecution: true, severeIncident: true, note: `Close replay blocked, missing tracked trade for ${intent.intent.symbol}` });
      return buildReplayBlock(`No open tracked trade found for ${intent.intent.symbol}.`, { tradeId: intent.tradeId || null, replayPolicy });
    }
    if (!livePosition) {
      recordExecutionIncident({ kind: "replay_blocked_missing_live_position", intentId: intent.id, symbol: intent.intent.symbol, action: "close", tradeId: trade.tradeId });
      recordBurnInEvent({ blockedExecution: true, driftEvent: true, note: `Close replay blocked, missing live position for ${intent.intent.symbol}` });
      return buildReplayBlock(`No live position found for ${intent.intent.symbol} during close replay.`, { tradeId: trade.tradeId, replayPolicy });
    }
    const replay = await closePerpPosition({ trade, livePosition });
    return finalizeReplay(replay, replayPolicy);
  }

  if (intent.intent.type === "open_position") {
    const existingOpenTrade = findOpenTradeBySymbol(intent.intent.symbol);
    if (existingOpenTrade) {
      recordExecutionIncident({ kind: "replay_blocked_existing_open_trade", intentId: intent.id, symbol: intent.intent.symbol, tradeId: existingOpenTrade.tradeId });
      recordBurnInEvent({ blockedExecution: true, severeIncident: true, note: `Open replay blocked, existing open trade for ${intent.intent.symbol}` });
      return buildReplayBlock(`Open trade already exists for ${intent.intent.symbol}.`, { tradeId: existingOpenTrade.tradeId, replayPolicy });
    }

    const replay = await openPerpPosition(intent.intent);
    return finalizeReplay(replay, replayPolicy);
  }

  recordExecutionIncident({ kind: "replay_blocked_unsupported_type", intentId: intent?.id || null, reason: intent?.intent?.type || "unknown" });
  recordBurnInEvent({ blockedExecution: true, severeIncident: true, note: `Replay blocked, unsupported intent type ${intent?.intent?.type || "unknown"}` });
  return buildReplayBlock(`Unsupported intent type: ${intent.intent.type}`, { replayPolicy });
}
