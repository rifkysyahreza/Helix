export function summarizeSymbolAnalysis(analysis = {}) {
  const structure = analysis.structure || {};
  const volatility = analysis.volatility || {};
  const vwapValue = analysis.vwapValue || {};
  const perpContext = analysis.perpContext || {};
  const orderBook = analysis.orderBook || {};
  const synthesis = analysis.synthesis || {};
  const multiTimeframe = analysis.multiTimeframe || {};
  const microstructure = analysis.microstructure || {};
  const tradeFlow = analysis.tradeFlow || {};
  const tradeVeto = analysis.tradeVeto || {};
  const orderFlowSignals = analysis.orderFlowSignals || {};
  const entryStyle = analysis.entryStyle || {};
  const executionTactics = analysis.executionTactics || {};

  const lines = [];
  lines.push(`Bias: ${synthesis.bias || "unknown"} (confidence=${synthesis.confidence ?? "n/a"})`);
  lines.push(`Structure: ${structure.regime || "unknown"} / ${structure.trendBias || "neutral"} (${structure.reason || "no_reason"})`);
  lines.push(`Volatility: ${volatility.regime || "unknown"} (${volatility.reason || "no_reason"})`);
  lines.push(`MTF: ${multiTimeframe.bias || "unknown"} / ${multiTimeframe.alignment || "unknown"}`);
  lines.push(`Value: ${vwapValue.location || "unknown"}, VWAP=${vwapValue.vwap ?? "n/a"}, POC=${vwapValue.poc ?? "n/a"}`);
  lines.push(`Perp context: ${perpContext.crowding || "unknown"}, funding=${perpContext.funding ?? "n/a"}, premium=${perpContext.premium ?? "n/a"}`);
  lines.push(`Order book: ${orderBook.depthBias || "unknown"}, spreadPct=${orderBook.spreadPct ?? "n/a"}, execution=${orderBook.executionQuality || "unknown"}`);
  lines.push(`Microstructure: ${microstructure.regime || "unknown"}, liquidityShift=${microstructure.liquidityShift || "unknown"}, absorption=${microstructure.absorptionHint ?? "n/a"}`);
  lines.push(`Trade flow: ${tradeFlow.deltaBias || "unknown"}, delta=${tradeFlow.delta ?? "n/a"}, aggression=${tradeFlow.aggressionBias || "unknown"}`);
  lines.push(`Order flow signals: ${orderFlowSignals.signalBias || "unknown"}, divergence=${orderFlowSignals.divergence || "none"}, sweep=${orderFlowSignals.liquiditySweep || "none"}, absorption=${orderFlowSignals.absorption ?? "n/a"}`);
  lines.push(`Entry style: ${entryStyle.style || "unknown"}, aggression=${entryStyle.aggression || "n/a"}, confidence=${entryStyle.confidence ?? "n/a"}`);
  lines.push(`Execution tactics: ${executionTactics.orderStyle || "unknown"}, urgency=${executionTactics.urgency || "n/a"}, aggressionBps=${executionTactics.aggressionBps ?? "n/a"}`);
  if (Array.isArray(tradeVeto.cautions) && tradeVeto.cautions.length) {
    lines.push(`Live cautions: ${tradeVeto.cautions.join(", ")}`);
  }
  if (Array.isArray(synthesis.riskFlags) && synthesis.riskFlags.length) {
    lines.push(`Risk flags: ${synthesis.riskFlags.join(", ")}`);
  }
  if (Array.isArray(synthesis.reasons) && synthesis.reasons.length) {
    lines.push(`Reasons: ${synthesis.reasons.join(", ")}`);
  }
  return lines.join("\n");
}
