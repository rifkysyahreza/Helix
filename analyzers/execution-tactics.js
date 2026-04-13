function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

export function deriveExecutionTactics({ snapshot = null, analysis = null, side = null } = {}) {
  const entryStyle = analysis?.entryStyle || {};
  const orderBook = analysis?.orderBook || {};
  const microstructure = analysis?.microstructure || {};
  const tradeVeto = analysis?.tradeVeto || {};
  const markPx = Number(snapshot?.markPx || snapshot?.midPx || snapshot?.oraclePx || 0) || null;
  const spreadPct = Number(orderBook.spreadPct || microstructure.avgSpreadPct || 0) || 0;

  let orderStyle = "ioc_limit";
  let urgency = "normal";
  let aggressionBps = 30;
  let scalePlan = "single_clip";

  if (entryStyle.style === "breakout") {
    orderStyle = "ioc_limit";
    urgency = "high";
    aggressionBps = spreadPct > 0.05 ? 35 : 25;
    scalePlan = "join_strength_once_confirmed";
  } else if (entryStyle.style === "pullback") {
    orderStyle = "resting_limit_preferred";
    urgency = "patient";
    aggressionBps = 15;
    scalePlan = "scale_on_retest";
  } else if (entryStyle.style === "fade") {
    orderStyle = "small_probe_limit";
    urgency = "low";
    aggressionBps = 10;
    scalePlan = "probe_then_confirm";
  } else {
    orderStyle = "stand_aside";
    urgency = "none";
    aggressionBps = 0;
    scalePlan = "none";
  }

  if (microstructure.regime === "thin") aggressionBps = Math.min(aggressionBps, 15);
  if (Array.isArray(tradeVeto.cautions) && tradeVeto.cautions.length) aggressionBps = Math.min(aggressionBps, 20);

  const referencePx = markPx;
  const entryBufferPct = entryStyle.style === "breakout"
    ? round(Math.max(spreadPct * 1.5, 0.03), 4)
    : entryStyle.style === "pullback"
      ? round(Math.max(spreadPct, 0.02), 4)
      : entryStyle.style === "fade"
        ? round(Math.max(spreadPct * 0.8, 0.015), 4)
        : 0;

  return {
    orderStyle,
    urgency,
    aggressionBps,
    scalePlan,
    entryBufferPct,
    referencePx,
    side,
    notes: [
      `Execution tactic: ${entryStyle.style || "unknown"} -> ${orderStyle}.`,
      `Urgency: ${urgency}.`,
      `Aggression bps: ${aggressionBps}.`,
      `Scale plan: ${scalePlan}.`,
    ],
  };
}
