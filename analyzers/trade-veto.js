export function evaluateTradeVeto({ analysis = null, requestedSide = null } = {}) {
  const synthesis = analysis?.synthesis || {};
  const multiTimeframe = analysis?.multiTimeframe || {};
  const orderBook = analysis?.orderBook || {};
  const vwapValue = analysis?.vwapValue || {};
  const perpContext = analysis?.perpContext || {};

  const vetoes = [];

  if (synthesis.bias === "no_trade") vetoes.push("synthesis_no_trade");
  if (orderBook.executionQuality === "poor") vetoes.push("poor_execution_quality");
  if (multiTimeframe.alignment === "mixed" && synthesis.confidence < 0.7) vetoes.push("mtf_misalignment");
  if (vwapValue.location === "inside_value" && synthesis.confidence < 0.7) vetoes.push("inside_value_weak_location");
  if (perpContext.crowding === "long_crowded" && requestedSide === "long") vetoes.push("long_crowding");
  if (perpContext.crowding === "short_crowded" && requestedSide === "short") vetoes.push("short_crowding");

  return {
    allowed: vetoes.length === 0,
    vetoes,
    reason: vetoes[0] || null,
  };
}
