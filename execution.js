import { validateNewPositionRisk, validateCloseRisk } from "./risk.js";
import { getLiveExecutionReadiness } from "./live-execution.js";
import { createExchangeClient } from "./hyperliquid-client.js";

function executionMode() {
  if (process.env.HELIX_ENABLE_LIVE_EXECUTION === "true") return "live";
  return process.env.DRY_RUN === "true" ? "dry-run" : "paper";
}

function buildExecutionContext() {
  return {
    mode: executionMode(),
    masterAccountAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS || null,
    agentWalletAddress: process.env.HYPERLIQUID_AGENT_WALLET_ADDRESS || null,
    usingAgentWallet: Boolean(process.env.HYPERLIQUID_AGENT_WALLET_ADDRESS),
  };
}

export async function openPerpPosition(params) {
  const context = buildExecutionContext();
  const risk = validateNewPositionRisk(params);
  if (!risk.ok) {
    return {
      success: false,
      blocked: true,
      risk,
      context,
    };
  }

  if (context.mode === "live") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Live execution not ready." },
      };
    }

    const exchange = createExchangeClient();
    const result = await exchange.order({
      orders: [{
        a: params.asset,
        b: params.side === "long",
        p: String(params.price),
        s: String(params.size),
        r: false,
        t: { limit: { tif: params.tif || "Ioc" } },
      }],
      grouping: "na",
    }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

    return {
      success: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: "open_position",
        result,
      },
    };
  }

  return {
    success: true,
    context,
    execution: {
      mode: context.mode,
      action: "open_position",
      symbol: params.symbol,
      side: params.side,
      sizeUsd: params.sizeUsd,
      leverage: params.leverage,
      note: "Dry-run/paper execution recorded through guarded execution seam.",
    },
  };
}

export async function closePerpPosition({ trade }) {
  const context = buildExecutionContext();
  const risk = validateCloseRisk({ trade });
  if (!risk.ok) {
    return {
      success: false,
      blocked: true,
      risk,
      context,
    };
  }

  if (context.mode === "live") {
    return {
      success: false,
      blocked: true,
      risk,
      context: { ...context, readiness: getLiveExecutionReadiness() },
      execution: {
        note: "Live close is not fully implemented yet. Need order-id-based reduce/cancel/close reconciliation path.",
      },
    };
  }

  return {
    success: true,
    context,
    execution: {
      mode: context.mode,
      action: "close_position",
      tradeId: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
      note: "Dry-run/paper close recorded through guarded execution seam.",
    },
  };
}
