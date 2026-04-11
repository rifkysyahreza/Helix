import { fetchClearingState } from "./tools/hyperliquid.js";

export async function getNormalizedAccountState() {
  const user = process.env.HYPERLIQUID_ACCOUNT_ADDRESS || "";
  const raw = await fetchClearingState(user);
  const assetPositions = raw?.assetPositions || [];

  const positions = assetPositions.map((entry) => {
    const pos = entry.position || {};
    return {
      coin: pos.coin || null,
      szi: pos.szi != null ? Number(pos.szi) : null,
      entryPx: pos.entryPx != null ? Number(pos.entryPx) : null,
      positionValue: pos.positionValue != null ? Number(pos.positionValue) : null,
      unrealizedPnl: pos.unrealizedPnl != null ? Number(pos.unrealizedPnl) : null,
      returnOnEquity: pos.returnOnEquity != null ? Number(pos.returnOnEquity) : null,
      leverage: pos.leverage?.value != null ? Number(pos.leverage.value) : null,
      liquidationPx: pos.liquidationPx != null ? Number(pos.liquidationPx) : null,
      marginUsed: pos.marginUsed != null ? Number(pos.marginUsed) : null,
      side: Number(pos.szi || 0) > 0 ? "long" : Number(pos.szi || 0) < 0 ? "short" : "flat",
    };
  });

  return {
    user,
    marginSummary: raw?.marginSummary || null,
    crossMaintenanceMarginUsed: raw?.crossMaintenanceMarginUsed || null,
    withdrawable: raw?.withdrawable || null,
    positions,
    raw,
  };
}
