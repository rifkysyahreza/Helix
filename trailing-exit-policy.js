export function evaluateTrailingExit({ trade = null, analysis = null, livePosition = null } = {}) {
  if (!trade || !livePosition) {
    return { action: "hold", reason: "missing_trade_or_live_position" };
  }

  const roe = Number(livePosition.returnOnEquity || 0);
  const bias = analysis?.synthesis?.bias || "neutral";
  const valueLocation = analysis?.vwapValue?.valueLocation || "unknown";
  const flowBias = analysis?.orderFlowSignals?.directionalBias || analysis?.tradeFlow?.bias || "neutral";
  const side = trade.side === "short" ? "short" : "long";

  if (roe >= 10 && flowBias !== side) {
    return { action: "reduce", reducePct: 25, reason: "trail_profit_on_flow_reversal" };
  }
  if (roe >= 6 && bias !== "neutral" && bias !== side) {
    return { action: "reduce", reducePct: 25, reason: "trail_profit_on_bias_flip" };
  }
  if (roe >= 4 && valueLocation === (side === "long" ? "above_value" : "below_value")) {
    return { action: "hold", reason: "trend_acceptance_still_favorable" };
  }
  if (roe >= 4 && valueLocation === (side === "long" ? "below_value" : "above_value")) {
    return { action: "reduce", reducePct: 25, reason: "acceptance_lost_against_position" };
  }

  return { action: "hold", reason: "no_trailing_exit_signal" };
}
