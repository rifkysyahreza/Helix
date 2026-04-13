export function analyzeEntryStyle({ analysis = null, requestedSide = null } = {}) {
  const synthesis = analysis?.synthesis || {};
  const vwapValue = analysis?.vwapValue || {};
  const structure = analysis?.structure || {};
  const multiTimeframe = analysis?.multiTimeframe || {};
  const tradeFlow = analysis?.tradeFlow || {};
  const microstructure = analysis?.microstructure || {};
  const orderFlowSignals = analysis?.orderFlowSignals || {};
  const tradeVeto = analysis?.tradeVeto || {};

  const side = requestedSide || (synthesis.bias === "short" ? "short" : synthesis.bias === "long" ? "long" : null);
  const reasons = [];

  if (!side || synthesis.bias === "no_trade" || tradeVeto.allowed === false) {
    return {
      style: "no_trade",
      side,
      confidence: 0,
      aggression: "none",
      reasons: [tradeVeto.reason || "no_trade_bias"],
    };
  }

  const aligned = multiTimeframe.alignment === "aligned";
  const compression = structure.regime === "compression";
  const location = vwapValue.location || "unknown";
  const flowConfirmLong = tradeFlow.deltaBias === "buy_pressure" && orderFlowSignals.signalBias === "long_confirm";
  const flowConfirmShort = tradeFlow.deltaBias === "sell_pressure" && orderFlowSignals.signalBias === "short_confirm";
  const flowConflict = orderFlowSignals.signalBias === "caution" || orderFlowSignals.absorption;

  let style = "no_trade";
  let confidence = 0.35;
  let aggression = "low";

  if (side === "long" && aligned && compression && location !== "inside_value" && flowConfirmLong && !flowConflict) {
    style = "breakout";
    confidence = 0.78;
    aggression = "high";
    reasons.push("aligned_long_breakout_conditions");
  } else if (side === "short" && aligned && compression && location !== "inside_value" && flowConfirmShort && !flowConflict) {
    style = "breakout";
    confidence = 0.78;
    aggression = "high";
    reasons.push("aligned_short_breakout_conditions");
  } else if (side === "long" && aligned && location === "above_value" && !flowConflict) {
    style = "pullback";
    confidence = 0.72;
    aggression = "medium";
    reasons.push("long_pullback_in_acceptance");
  } else if (side === "short" && aligned && location === "below_value" && !flowConflict) {
    style = "pullback";
    confidence = 0.72;
    aggression = "medium";
    reasons.push("short_pullback_in_acceptance");
  } else if (side === "long" && location === "below_value" && orderFlowSignals.divergence === "bearish_flow_vs_bid_support") {
    style = "fade";
    confidence = 0.58;
    aggression = "low";
    reasons.push("long_fade_against_sell_exhaustion");
  } else if (side === "short" && location === "above_value" && orderFlowSignals.divergence === "bullish_flow_vs_offer_resistance") {
    style = "fade";
    confidence = 0.58;
    aggression = "low";
    reasons.push("short_fade_against_buy_exhaustion");
  } else {
    style = "no_trade";
    confidence = 0.3;
    aggression = "none";
    reasons.push("entry_conditions_not_clean");
  }

  if (microstructure.regime === "thin") {
    aggression = "low";
    confidence -= 0.12;
    reasons.push("thin_microstructure_penalty");
  }
  if (Array.isArray(tradeVeto.cautions) && tradeVeto.cautions.length) {
    confidence -= Math.min(0.2, tradeVeto.cautions.length * 0.04);
    reasons.push("live_cautions_present");
  }

  confidence = Number(Math.max(0, Math.min(1, confidence)).toFixed(2));

  return {
    style,
    side,
    confidence,
    aggression,
    reasons,
  };
}
