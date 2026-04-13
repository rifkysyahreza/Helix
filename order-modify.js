import { createExchangeClient } from "./hyperliquid-client.js";
import { getTradeById, updateTradeExecutionState, updateTradeLifecycle } from "./state.js";
import { recordExecutionIncident } from "./execution-incidents.js";

function mode() {
  return process.env.HELIX_EXECUTION_MODE || (process.env.HELIX_ENABLE_LIVE_EXECUTION === "true" ? "autonomous" : (process.env.DRY_RUN === "true" ? "dry-run" : "paper"));
}

export async function replaceRestingOrder({ tradeId, price, size = null, tif = "Gtc" }) {
  const trade = getTradeById(tradeId);
  if (!trade) return { replaced: false, error: "trade_not_found" };

  const oid = trade.executionState?.restingOrderOid || trade.exchange?.oid || null;
  const asset = trade.snapshot?.assetIndex;
  const isBuy = trade.side === "long";
  const finalSize = size ?? trade.executionState?.remainingOpenSize ?? trade.sizeUsd;

  if (oid == null || asset == null || !price || !finalSize) {
    return { replaced: false, error: "missing_modify_identity_or_payload", tradeId, oid, asset, price, size: finalSize };
  }

  if (mode() !== "autonomous") {
    updateTradeExecutionState(tradeId, {
      modifyRequested: true,
      modifyRequestedAt: new Date().toISOString(),
      modifyPreview: { oid, asset, price, size: finalSize, tif },
    });
    recordExecutionIncident({ kind: "resting_order_modify_requested_non_live", tradeId, oid, asset, price, size: finalSize, tif, mode: mode() });
    return {
      replaced: false,
      requiresLiveMode: true,
      tradeId,
      oid,
      asset,
      price,
      size: finalSize,
      tif,
      mode: mode(),
    };
  }

  const exchange = createExchangeClient();
  const result = await exchange.modify({
    oid: Number(oid),
    order: {
      a: Number(asset),
      b: isBuy,
      p: String(price),
      s: String(finalSize),
      r: false,
      t: { limit: { tif } },
    },
  }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

  updateTradeExecutionState(tradeId, {
    modifyRequested: false,
    modifiedRestingOrderAt: new Date().toISOString(),
    modifyResult: result,
    restingOrderLastPrice: Number(price),
    restingOrderLastSize: Number(finalSize),
  });
  updateTradeLifecycle(tradeId, {
    lastExchangeState: "resting_order_repriced",
  });
  recordExecutionIncident({ kind: "resting_order_modify_submitted", tradeId, oid, asset, price, size: finalSize, tif });

  return { replaced: true, tradeId, oid, asset, price, size: finalSize, tif, result };
}
