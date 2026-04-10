import { config } from "./config.js";

export function validateNewPositionRisk({ symbol, side, sizeUsd, leverage }) {
  const issues = [];

  if (!symbol) issues.push("symbol_required");
  if (!side || !["long", "short"].includes(side)) issues.push("invalid_side");
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) issues.push("invalid_size");
  if (Number(sizeUsd) > config.risk.maxPositionNotionalUsd) issues.push("size_above_max_position_notional");
  if (Number(leverage) > config.risk.maxLeverage) issues.push("leverage_above_max");
  if (config.screening.allowedSymbols?.length && !config.screening.allowedSymbols.includes(symbol)) issues.push("symbol_not_in_allowed_list");
  if (config.screening.blockedSymbols?.includes(symbol)) issues.push("symbol_blocked");

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateCloseRisk({ trade }) {
  if (!trade) {
    return { ok: false, issues: ["trade_missing"] };
  }
  return { ok: true, issues: [] };
}
