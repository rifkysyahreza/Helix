import { validateNewPositionRisk, validateCloseRisk } from "./risk.js";

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
      note: context.mode === "live"
        ? "Live adapter not implemented yet. This is the guarded execution seam."
        : "Dry-run/paper execution recorded through guarded execution seam.",
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

  return {
    success: true,
    context,
    execution: {
      mode: context.mode,
      action: "close_position",
      tradeId: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
      note: context.mode === "live"
        ? "Live close adapter not implemented yet. This is the guarded execution seam."
        : "Dry-run/paper close recorded through guarded execution seam.",
    },
  };
}
