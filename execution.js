import { validateNewPositionRisk, validateCloseRisk } from "./risk.js";
import { getLiveExecutionReadiness } from "./live-execution.js";
import { createExchangeClient } from "./hyperliquid-client.js";

function executionMode() {
  return process.env.HELIX_EXECUTION_MODE || (process.env.HELIX_ENABLE_LIVE_EXECUTION === "true" ? "autonomous" : (process.env.DRY_RUN === "true" ? "dry-run" : "paper"));
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
    return { success: false, blocked: true, risk, context };
  }

  if (context.mode === "approval") {
    return {
      success: true,
      requiresApproval: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: "open_position",
        symbol: params.symbol,
        side: params.side,
        sizeUsd: params.sizeUsd,
        leverage: params.leverage,
        note: "Approval mode: generated exact action intent but did not execute.",
      },
    };
  }

  if (context.mode === "autonomous") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Autonomous live execution not ready." },
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

export async function reducePerpPosition({ symbol, side, reducePct = 100, size = null, livePosition = null }) {
  const context = buildExecutionContext();
  const risk = validateCloseRisk({ trade: { symbol, side } });
  if (!risk.ok) {
    return { success: false, blocked: true, risk, context };
  }

  if (context.mode === "approval") {
    return {
      success: true,
      requiresApproval: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: reducePct >= 100 ? "close_position" : "reduce_position",
        symbol,
        side,
        reducePct,
        size,
        note: "Approval mode: generated exact reduce intent but did not execute.",
      },
    };
  }

  if (context.mode === "autonomous") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Autonomous live execution not ready." },
      };
    }

    if (!livePosition || !livePosition.coin || !livePosition.szi) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "No live position found to reduce." },
      };
    }

    const exchange = createExchangeClient();
    const closeSideIsBuy = Number(livePosition.szi) < 0;
    const liveSize = Math.abs(Number(livePosition.szi || 0));
    const reduceSize = size != null ? Math.abs(Number(size)) : liveSize * (Math.max(0, Math.min(100, reducePct)) / 100);

    const result = await exchange.order({
      orders: [{
        a: livePosition.asset ?? livePosition.assetIndex ?? 0,
        b: closeSideIsBuy,
        p: String(livePosition.entryPx || 0),
        s: String(reduceSize),
        r: true,
        t: { market: {} },
      }],
      grouping: "na",
    }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

    return {
      success: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: reducePct >= 100 ? "close_position" : "reduce_position",
        reducePct,
        result,
      },
    };
  }

  return {
    success: true,
    context,
    execution: {
      mode: context.mode,
      action: reducePct >= 100 ? "close_position" : "reduce_position",
      symbol,
      side,
      reducePct,
      size,
      note: "Dry-run/paper reduce recorded through guarded execution seam.",
    },
  };
}

export async function closePerpPosition({ trade, livePosition = null }) {
  const context = buildExecutionContext();
  const risk = validateCloseRisk({ trade });
  if (!risk.ok) {
    return { success: false, blocked: true, risk, context };
  }

  if (context.mode === "approval") {
    return {
      success: true,
      requiresApproval: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: "close_position",
        tradeId: trade.tradeId,
        symbol: trade.symbol,
        side: trade.side,
        note: "Approval mode: generated exact close intent but did not execute.",
      },
    };
  }

  if (context.mode === "autonomous") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Autonomous live execution not ready." },
      };
    }

    return await reducePerpPosition({
      symbol: trade.symbol,
      side: trade.side,
      reducePct: 100,
      size: Math.abs(Number(livePosition?.szi || 0)),
      livePosition,
    });
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
