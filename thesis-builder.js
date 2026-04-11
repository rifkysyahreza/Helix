import { summarizeOperatorKnowledge } from "./operator-knowledge.js";
import { getPerformanceProfileSummary } from "./performance-profile.js";

export function buildTradeThesis({ symbol, side, snapshot, scored }) {
  const operatorKnowledge = summarizeOperatorKnowledge(5);
  const perfProfile = getPerformanceProfileSummary().profile;
  const symbolProfile = perfProfile?.bySymbol?.[symbol] || null;

  const thesisParts = [];

  if (snapshot) {
    thesisParts.push(`Funding=${snapshot.funding}`);
    thesisParts.push(`OI=${snapshot.openInterest}`);
    thesisParts.push(`24h volume=${snapshot.dayNtlVlm}`);
    thesisParts.push(`premium=${snapshot.premium}`);
    thesisParts.push(`bias=${scored.sideBias}`);
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

  return {
    symbol,
    side,
    thesis: thesisParts.join(", "),
    operatorKnowledge,
    symbolProfile,
    scored,
    snapshot,
  };
}
