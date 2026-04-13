export function evaluateTradeVeto({ analysis = null, requestedSide = null } = {}) {
  const synthesis = analysis?.synthesis || {};
  const multiTimeframe = analysis?.multiTimeframe || {};
  const orderBook = analysis?.orderBook || {};
  const vwapValue = analysis?.vwapValue || {};
  const perpContext = analysis?.perpContext || {};
  const microstructure = analysis?.microstructure || {};
  const tradeFlow = analysis?.tradeFlow || {};
  const orderFlowSignals = analysis?.orderFlowSignals || {};

  const vetoes = [];
  const cautions = [];

  if (synthesis.bias === "no_trade") vetoes.push("synthesis_no_trade");
  if (orderBook.executionQuality === "poor") vetoes.push("poor_execution_quality");
  if (multiTimeframe.alignment === "mixed" && synthesis.confidence < 0.7) vetoes.push("mtf_misalignment");
  if (vwapValue.location === "inside_value" && synthesis.confidence < 0.7) vetoes.push("inside_value_weak_location");
  if (perpContext.crowding === "long_crowded" && requestedSide === "long") vetoes.push("long_crowding");
  if (perpContext.crowding === "short_crowded" && requestedSide === "short") vetoes.push("short_crowding");

  if (microstructure.regime === "thin") vetoes.push("thin_microstructure");
  if (requestedSide === "long" && microstructure.liquidityShift === "ask_strengthening") cautions.push("microstructure_against_long");
  if (requestedSide === "short" && microstructure.liquidityShift === "bid_strengthening") cautions.push("microstructure_against_short");
  if (requestedSide === "long" && tradeFlow.deltaBias === "sell_pressure") cautions.push("trade_flow_against_long");
  if (requestedSide === "short" && tradeFlow.deltaBias === "buy_pressure") cautions.push("trade_flow_against_short");
  if (microstructure.absorptionHint && synthesis.confidence < 0.75) cautions.push("possible_absorption");
  if (orderFlowSignals.absorption) cautions.push("flow_absorption_conflict");
  if (orderFlowSignals.divergence !== "none") cautions.push(orderFlowSignals.divergence);
  if (orderFlowSignals.liquiditySweep !== "none") cautions.push(orderFlowSignals.liquiditySweep);
  if (orderFlowSignals.signalBias === "avoid") vetoes.push("order_flow_avoid");

  return {
    allowed: vetoes.length === 0,
    vetoes,
    cautions,
    reason: vetoes[0] || cautions[0] || null,
  };
}
