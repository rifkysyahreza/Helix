import { config } from "./config.js";

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function validateNewPositionRisk({ symbol, side, sizeUsd, leverage, account = null, existingTrades = [] }) {
  const issues = [];
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedSide = String(side || "").trim().toLowerCase();
  const numericSizeUsd = Number(sizeUsd);
  const numericLeverage = leverage == null ? 1 : Number(leverage);

  if (!normalizedSymbol) issues.push("symbol_required");
  if (!normalizedSide || !["long", "short"].includes(normalizedSide)) issues.push("invalid_side");
  if (!Number.isFinite(numericSizeUsd) || numericSizeUsd <= 0) issues.push("invalid_size");
  if (!Number.isFinite(numericLeverage) || numericLeverage <= 0) issues.push("invalid_leverage");
  if (Number.isFinite(numericSizeUsd) && numericSizeUsd > config.risk.maxPositionNotionalUsd) issues.push("size_above_max_position_notional");
  if (Number.isFinite(numericLeverage) && numericLeverage > config.risk.maxLeverage) issues.push("leverage_above_max");
  if (config.screening.allowedSymbols?.length && !config.screening.allowedSymbols.map(normalizeSymbol).includes(normalizedSymbol)) issues.push("symbol_not_in_allowed_list");
  if (config.screening.blockedSymbols?.map(normalizeSymbol).includes(normalizedSymbol)) issues.push("symbol_blocked");

  const openTrades = Array.isArray(existingTrades)
    ? existingTrades.filter((trade) => trade?.status === "open")
    : [];

  if (openTrades.length >= config.risk.maxConcurrentPositions) {
    issues.push("max_concurrent_positions_reached");
  }

  if (normalizedSymbol && openTrades.some((trade) => normalizeSymbol(trade.symbol) === normalizedSymbol)) {
    issues.push("symbol_already_open");
  }

  const openExposureUsd = openTrades.reduce((sum, trade) => sum + Number(trade.sizeUsd || 0), 0);
  if (Number.isFinite(numericSizeUsd) && (openExposureUsd + numericSizeUsd) > config.risk.maxTotalExposureUsd) {
    issues.push("total_exposure_above_max");
  }

  const withdrawable = account?.withdrawable != null ? Number(account.withdrawable) : null;
  if (withdrawable != null && Number.isFinite(numericSizeUsd) && numericSizeUsd > withdrawable) {
    issues.push("size_above_withdrawable_buffer");
  }

  return {
    ok: issues.length === 0,
    issues,
    normalizedSymbol,
    normalizedSide,
    requestedSizeUsd: Number.isFinite(numericSizeUsd) ? numericSizeUsd : null,
    openExposureUsd,
    maxAllowedExposureUsd: config.risk.maxTotalExposureUsd,
  };
}

export function validateCloseRisk({ trade, account = null }) {
  const issues = [];

  if (!trade) {
    return { ok: false, issues: ["trade_missing"] };
  }

  if (trade.status === "closed") {
    issues.push("trade_already_closed");
  }

  const livePosition = account?.positions?.find((position) => normalizeSymbol(position.coin) === normalizeSymbol(trade.symbol));
  if (account?.positions && !livePosition) {
    issues.push("live_position_missing");
  }

  return {
    ok: issues.length === 0,
    issues,
    livePosition: livePosition || null,
  };
}
