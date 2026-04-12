export const EXECUTION_PHASES = {
  OPEN_PENDING: "open_pending",
  OPEN_RESTING: "open_resting",
  OPEN_PARTIAL: "open_partial",
  OPEN_FILLED: "open_filled",
  OPEN_CANCELLED: "open_cancelled",
  REDUCE_PENDING: "reduce_pending",
  REDUCE_PARTIAL: "reduce_partial",
  REDUCE_FILLED: "reduce_filled",
  CLOSE_PENDING: "close_pending",
  CLOSE_PARTIAL: "close_partial",
  CLOSE_FILLED: "close_filled",
  CLOSED: "closed",
  ERROR: "error",
  UNKNOWN: "unknown",
};

function clampSize(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(8));
}

export function inferExecutionPhase({ action, verification, hasOpenOrder = false, remainingSize = null, tradeStatus = "open" }) {
  const label = verification?.executionLabel || "unknown";
  const remaining = clampSize(remainingSize);

  if (tradeStatus === "closed" && (remaining == null || remaining <= 0)) {
    return EXECUTION_PHASES.CLOSED;
  }

  if (label === "error") return EXECUTION_PHASES.ERROR;
  if (label === "ioc_cancel") return action === "open" ? EXECUTION_PHASES.OPEN_CANCELLED : EXECUTION_PHASES.ERROR;

  if (action === "open") {
    if (label === "filled") return EXECUTION_PHASES.OPEN_FILLED;
    if (label === "partial_fill") return hasOpenOrder || (remaining != null && remaining > 0) ? EXECUTION_PHASES.OPEN_PARTIAL : EXECUTION_PHASES.OPEN_FILLED;
    if (label === "resting") return EXECUTION_PHASES.OPEN_RESTING;
    return EXECUTION_PHASES.OPEN_PENDING;
  }

  if (action === "reduce") {
    if (label === "filled") return remaining != null && remaining > 0 ? EXECUTION_PHASES.REDUCE_PARTIAL : EXECUTION_PHASES.REDUCE_FILLED;
    if (label === "partial_fill") return EXECUTION_PHASES.REDUCE_PARTIAL;
    if (label === "resting") return EXECUTION_PHASES.REDUCE_PENDING;
    return EXECUTION_PHASES.REDUCE_PENDING;
  }

  if (action === "close") {
    if (label === "filled") return remaining != null && remaining > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    if (label === "partial_fill") return EXECUTION_PHASES.CLOSE_PARTIAL;
    if (label === "resting") return EXECUTION_PHASES.CLOSE_PENDING;
    return EXECUTION_PHASES.CLOSE_PENDING;
  }

  return EXECUTION_PHASES.UNKNOWN;
}

export function deriveExchangePhase({
  exchangeState,
  tradeStatus = "open",
  hasOpenOrder = false,
  remainingCloseSize = null,
  remainingReduceSize = null,
  lastIntentAction = null,
}) {
  if (tradeStatus === "closed") return EXECUTION_PHASES.CLOSED;

  const remainingClose = clampSize(remainingCloseSize);
  const remainingReduce = clampSize(remainingReduceSize);
  const hasCloseContext = remainingClose != null;
  const hasReduceContext = remainingReduce != null;
  const preferClose = lastIntentAction === "close";
  const preferReduce = lastIntentAction === "reduce";

  if (exchangeState === "filled") {
    if (lastIntentAction === "open") return EXECUTION_PHASES.OPEN_FILLED;
    if (preferClose && hasCloseContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    if (preferReduce && hasReduceContext) return remainingReduce > 0 ? EXECUTION_PHASES.REDUCE_PARTIAL : EXECUTION_PHASES.REDUCE_FILLED;
    if (hasCloseContext && !hasReduceContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    if (hasReduceContext) return remainingReduce > 0 ? EXECUTION_PHASES.REDUCE_PARTIAL : EXECUTION_PHASES.REDUCE_FILLED;
    if (hasCloseContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    return EXECUTION_PHASES.OPEN_FILLED;
  }

  if (exchangeState === "partially_filled") {
    if (lastIntentAction === "open") return hasOpenOrder ? EXECUTION_PHASES.OPEN_PARTIAL : EXECUTION_PHASES.OPEN_FILLED;
    if (preferClose && hasCloseContext) return EXECUTION_PHASES.CLOSE_PARTIAL;
    if (preferReduce && hasReduceContext) return EXECUTION_PHASES.REDUCE_PARTIAL;
    if (hasCloseContext && !hasReduceContext) return EXECUTION_PHASES.CLOSE_PARTIAL;
    if (hasReduceContext) return EXECUTION_PHASES.REDUCE_PARTIAL;
    if (hasCloseContext) return EXECUTION_PHASES.CLOSE_PARTIAL;
    return hasOpenOrder ? EXECUTION_PHASES.OPEN_PARTIAL : EXECUTION_PHASES.OPEN_FILLED;
  }

  if (exchangeState === "cancelled") {
    if (lastIntentAction === "open") return EXECUTION_PHASES.OPEN_CANCELLED;
    if (preferClose && hasCloseContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    if (preferReduce && hasReduceContext) return remainingReduce > 0 ? EXECUTION_PHASES.REDUCE_PARTIAL : EXECUTION_PHASES.REDUCE_FILLED;
    if (hasCloseContext && !hasReduceContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    if (hasReduceContext) return remainingReduce > 0 ? EXECUTION_PHASES.REDUCE_PARTIAL : EXECUTION_PHASES.REDUCE_FILLED;
    if (hasCloseContext) return remainingClose > 0 ? EXECUTION_PHASES.CLOSE_PARTIAL : EXECUTION_PHASES.CLOSE_FILLED;
    return EXECUTION_PHASES.OPEN_CANCELLED;
  }

  if (exchangeState === "open") {
    if (preferClose && hasCloseContext) return EXECUTION_PHASES.CLOSE_PENDING;
    if (preferReduce && hasReduceContext) return EXECUTION_PHASES.REDUCE_PENDING;
    if (hasCloseContext && !hasReduceContext) return EXECUTION_PHASES.CLOSE_PENDING;
    if (hasReduceContext) return EXECUTION_PHASES.REDUCE_PENDING;
    if (hasCloseContext) return EXECUTION_PHASES.CLOSE_PENDING;
    return EXECUTION_PHASES.OPEN_RESTING;
  }

  return EXECUTION_PHASES.UNKNOWN;
}
