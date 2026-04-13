export function summarizeSymbolAnalysis(analysis = {}) {
  const structure = analysis.structure || {};
  const volatility = analysis.volatility || {};
  const vwapValue = analysis.vwapValue || {};
  const perpContext = analysis.perpContext || {};
  const orderBook = analysis.orderBook || {};
  const synthesis = analysis.synthesis || {};
  const multiTimeframe = analysis.multiTimeframe || {};

  const lines = [];
  lines.push(`Bias: ${synthesis.bias || "unknown"} (confidence=${synthesis.confidence ?? "n/a"})`);
  lines.push(`Structure: ${structure.regime || "unknown"} / ${structure.trendBias || "neutral"} (${structure.reason || "no_reason"})`);
  lines.push(`Volatility: ${volatility.regime || "unknown"} (${volatility.reason || "no_reason"})`);
  lines.push(`MTF: ${multiTimeframe.bias || "unknown"} / ${multiTimeframe.alignment || "unknown"}`);
  lines.push(`Value: ${vwapValue.location || "unknown"}, VWAP=${vwapValue.vwap ?? "n/a"}, POC=${vwapValue.poc ?? "n/a"}`);
  lines.push(`Perp context: ${perpContext.crowding || "unknown"}, funding=${perpContext.funding ?? "n/a"}, premium=${perpContext.premium ?? "n/a"}`);
  lines.push(`Order book: ${orderBook.depthBias || "unknown"}, spreadPct=${orderBook.spreadPct ?? "n/a"}, execution=${orderBook.executionQuality || "unknown"}`);
  if (Array.isArray(synthesis.riskFlags) && synthesis.riskFlags.length) {
    lines.push(`Risk flags: ${synthesis.riskFlags.join(", ")}`);
  }
  if (Array.isArray(synthesis.reasons) && synthesis.reasons.length) {
    lines.push(`Reasons: ${synthesis.reasons.join(", ")}`);
  }
  return lines.join("\n");
}
