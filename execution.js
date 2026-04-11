import { validateNewPositionRisk, validateCloseRisk } from "./risk.js";
import { getLiveExecutionReadiness } from "./live-execution.js";
import { createExchangeClient } from "./hyperliquid-client.js";
import { fetchAllMids, fetchL2Book } from "./tools/hyperliquid.js";

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

async function buildAggressiveIocPrice({ symbol, isBuy, fallbackPx = null }) {
  const [mids, book] = await Promise.all([
    fetchAllMids().catch(() => null),
    fetchL2Book(symbol).catch(() => null),
  ]);

  const mid = mids?.[symbol] != null ? Number(mids[symbol]) : null;
  const bids = book?.levels?.[0] || [];
  const asks = book?.levels?.[1] || [];
  const bestBid = bids.length ? Number(bids[0].px || bids[0].price || 0) : null;
  const bestAsk = asks.length ? Number(asks[0].px || asks[0].price || 0) : null;

  const reference = isBuy
    ? (bestAsk || mid || fallbackPx || 0)
    : (bestBid || mid || fallbackPx || 0);

  if (!reference || reference <= 0) {
    throw new Error(`Unable to derive aggressive IOC price for ${symbol}`);
  }

  const slippageBps = Number(process.env.HELIX_IOC_SLIPPAGE_BPS || 30);
  const multiplier = isBuy
    ? (1 + slippageBps / 10000)
    : (1 - slippageBps / 10000);

  return Number((reference * multiplier).toFixed(8));
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

    if (!(livePosition.asset != null) || reduceSize <= 0) {
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Missing live asset index or reduce size for reduce-only order." },
      };
    }

    const aggressivePx = await buildAggressiveIocPrice({
      symbol: livePosition.coin || symbol,
      isBuy: closeSideIsBuy,
      fallbackPx: livePosition.entryPx || null,
    });

    const result = await exchange.order({
      orders: [{
        a: Number(livePosition.asset),
        b: closeSideIsBuy,
        p: String(aggressivePx),
        s: String(reduceSize),
        r: true,
        t: { limit: { tif: "Ioc" } },
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
        aggressivePx,
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
