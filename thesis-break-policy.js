import { analyzeEntryStyle } from "./analyzers/entry-style.js";

export function evaluateThesisBreak({ trade = null, analysis = null, livePosition = null } = {}) {
  if (!trade || !analysis) {
    return { broken: false, confidence: 0, reason: "missing_trade_or_analysis" };
  }

  const side = trade.side === "short" ? "short" : "long";
  const synthesisBias = analysis?.synthesis?.bias || null;
  const veto = analysis?.tradeVeto || null;
  const mtfAlignment = analysis?.multiTimeframe?.alignment || "mixed";
  const orderFlowBias = analysis?.orderFlowSignals?.directionalBias || "neutral";
  const tradeFlowBias = analysis?.tradeFlow?.bias || "neutral";
  const entryStyle = analysis?.entryStyle?.style || analyzeEntryStyle({ analysis, requestedSide: side })?.style || "no_trade";
  const roe = Number(livePosition?.returnOnEquity || 0);

  let confidence = 0;
  const reasons = [];

  if (veto?.blocked) {
    confidence += 0.45;
    reasons.push(`veto:${(veto.reasons || []).join("|") || "blocked"}`);
  }
  if (synthesisBias && synthesisBias !== side) {
    confidence += 0.25;
    reasons.push(`bias_flip:${synthesisBias}`);
  }
  if (mtfAlignment === "strong_short" && side === "long") {
    confidence += 0.2;
    reasons.push("mtf_against_long");
  }
  if (mtfAlignment === "strong_long" && side === "short") {
    confidence += 0.2;
    reasons.push("mtf_against_short");
  }
  if (orderFlowBias && orderFlowBias !== "neutral" && orderFlowBias !== side) {
    confidence += 0.15;
    reasons.push(`order_flow_against:${orderFlowBias}`);
  }
  if (tradeFlowBias && tradeFlowBias !== "neutral" && tradeFlowBias !== side) {
    confidence += 0.1;
    reasons.push(`trade_flow_against:${tradeFlowBias}`);
  }
  if (entryStyle === "no_trade") {
    confidence += 0.15;
    reasons.push("entry_style_invalidated");
  }
  if (roe < -2) {
    confidence += 0.05;
    reasons.push("losing_position_confirmation");
  }

  const broken = confidence >= 0.45;
  return {
    broken,
    confidence: Number(confidence.toFixed(4)),
    reason: reasons[0] || "thesis_intact",
    reasons,
  };
}
