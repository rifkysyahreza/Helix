import { summarizeOperatorKnowledge } from "./operator-knowledge.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";
import { getLearnedBeliefs } from "./belief-updater.js";
import { buildPerpBaseKnowledge } from "./base-knowledge.js";

export function buildTradeThesis({ symbol, side, snapshot, scored }) {
  const operatorKnowledge = summarizeOperatorKnowledge(5);
  const perfProfile = getPerformanceProfileSummary().profile;
  const symbolProfile = perfProfile?.bySymbol?.[symbol] || null;
  const learnedBeliefs = getLearnedBeliefs();
  const learnedSymbolBelief = learnedBeliefs?.symbols?.[symbol] || null;
  const baseKnowledge = buildPerpBaseKnowledge();

  const thesisParts = [];

  if (snapshot) {
    thesisParts.push(`Funding=${snapshot.funding}`);
    thesisParts.push(`OI=${snapshot.openInterest}`);
    thesisParts.push(`24h volume=${snapshot.dayNtlVlm}`);
    thesisParts.push(`premium=${snapshot.premium}`);
    thesisParts.push(`bias=${scored.sideBias}`);
    if (scored?.synthesis?.bias) thesisParts.push(`synthesis_bias=${scored.synthesis.bias}`);
    if (scored?.synthesis?.confidence != null) thesisParts.push(`synthesis_confidence=${scored.synthesis.confidence}`);
    if (scored?.structure?.regime) thesisParts.push(`structure=${scored.structure.regime}/${scored.structure.trendBias}`);
    if (scored?.vwapValue?.location) thesisParts.push(`value_location=${scored.vwapValue.location}`);
    if (scored?.perpContext?.crowding) thesisParts.push(`crowding=${scored.perpContext.crowding}`);
    if (scored?.orderBook?.executionQuality) thesisParts.push(`execution_quality=${scored.orderBook.executionQuality}`);
    if (scored?.multiTimeframe?.alignment) thesisParts.push(`mtf_alignment=${scored.multiTimeframe.alignment}`);
    thesisParts.push(`perp_context_hint=${baseKnowledge.perpContext.concepts[0]}`);
    thesisParts.push(`execution_hint=${baseKnowledge.executionPrinciples.concepts[0]}`);
  } else {
    thesisParts.push("No market snapshot found");
  }

  if (symbolProfile) {
    thesisParts.push(`symbol_avg_pnl=${symbolProfile.avgPnlPct}`);
    thesisParts.push(`symbol_trade_count=${symbolProfile.count}`);
  }

  if (operatorKnowledge.length) {
    thesisParts.push(`operator_notes=${operatorKnowledge.map((note) => note.title).join(" | ")}`);
  }

  if (learnedSymbolBelief) {
    thesisParts.push(`belief_avg_pnl=${learnedSymbolBelief.avgPnlPct}`);
    thesisParts.push(`belief_wins=${learnedSymbolBelief.wins}`);
    thesisParts.push(`belief_losses=${learnedSymbolBelief.losses}`);
  }

  let suggestedSizeBias = scored?.symbolBias?.sizeBias || 1;
  let confidenceAdjustment = 0;

  if (learnedSymbolBelief) {
    if ((learnedSymbolBelief.avgPnlPct || 0) >= 3 && (learnedSymbolBelief.wins || 0) > (learnedSymbolBelief.losses || 0)) {
      suggestedSizeBias *= 1.1;
      confidenceAdjustment += 1;
    } else if ((learnedSymbolBelief.avgPnlPct || 0) <= -3 && (learnedSymbolBelief.losses || 0) >= (learnedSymbolBelief.wins || 0)) {
      suggestedSizeBias *= 0.8;
      confidenceAdjustment -= 1;
    }
  }

  return {
    symbol,
    side,
    thesis: thesisParts.join(", "),
    operatorKnowledge,
    symbolProfile,
    learnedSymbolBelief,
    scored,
    snapshot,
    baseKnowledge,
    suggestedSizeBias,
    confidenceAdjustment,
  };
}
