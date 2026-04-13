import { validateNewPositionRisk, validateCloseRisk } from "./risk.js";
import { getLiveExecutionReadiness } from "./live-execution.js";
import { createExchangeClient } from "./hyperliquid-client.js";
import { fetchAllMids, fetchL2Book } from "./tools/hyperliquid.js";
import { listRecentTrades } from "./state.js";
import { getNormalizedAccountState } from "./account-state.js";
import { recordExecutionIncident } from "./execution-incidents.js";
import { markRestingOrderPlaced } from "./resting-orders.js";

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

async function buildAggressiveIocPrice({ symbol, isBuy, fallbackPx = null, slippageBpsOverride = null }) {
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

  const slippageBps = slippageBpsOverride != null ? Number(slippageBpsOverride) : Number(process.env.HELIX_IOC_SLIPPAGE_BPS || 30);
  const multiplier = isBuy
    ? (1 + slippageBps / 10000)
    : (1 - slippageBps / 10000);

  return Number((reference * multiplier).toFixed(8));
}

function deriveOpenExecutionPolicy(params = {}) {
  const style = params.executionTactics?.orderStyle || "ioc_limit";
  const aggressionBps = Number(params.executionTactics?.aggressionBps || process.env.HELIX_IOC_SLIPPAGE_BPS || 30);

  if (style === "resting_limit_preferred") {
    return {
      tif: "Gtc",
      orderStyle: style,
      aggressionBps,
      note: "Pullback style prefers resting limit placement over immediate IOC crossing.",
    };
  }

  if (style === "small_probe_limit") {
    return {
      tif: "Gtc",
      orderStyle: style,
      aggressionBps: Math.min(aggressionBps, 10),
      note: "Fade style uses small probing passive placement first.",
    };
  }

  if (style === "stand_aside") {
    return {
      tif: "Ioc",
      orderStyle: style,
      aggressionBps: 0,
      blocked: true,
      note: "No-trade style should not execute live entry.",
    };
  }

  return {
    tif: "Ioc",
    orderStyle: style,
    aggressionBps,
    note: "Breakout/default style uses aggressive IOC entry.",
  };
}

async function buildOpenOrderSpec(params = {}) {
  const policy = deriveOpenExecutionPolicy(params);
  if (policy.blocked) {
    return { blocked: true, policy, reason: "execution_policy_blocks_entry" };
  }

  const isBuy = params.side === "long";
  let price = Number(params.price || 0) || null;

  if (policy.tif === "Ioc") {
    price = await buildAggressiveIocPrice({
      symbol: params.symbol,
      isBuy,
      fallbackPx: params.price,
      slippageBpsOverride: policy.aggressionBps,
    });
  }

  return {
    blocked: false,
    policy,
    order: {
      a: params.asset,
      b: isBuy,
      p: String(price),
      s: String(params.size),
      r: false,
      t: { limit: { tif: policy.tif } },
    },
  };
}

export async function openPerpPosition(params) {
  const context = buildExecutionContext();
  const account = await getNormalizedAccountState().catch(() => null);
  const existingTrades = listRecentTrades(500);
  const risk = validateNewPositionRisk({ ...params, account, existingTrades });
  if (!risk.ok) {
    recordExecutionIncident({ kind: "open_risk_block", symbol: params.symbol, side: params.side, issues: risk.issues, context });
    return { success: false, blocked: true, risk, context };
  }

  const orderSpec = await buildOpenOrderSpec(params);
  if (orderSpec.blocked) {
    recordExecutionIncident({ kind: "open_policy_block", symbol: params.symbol, side: params.side, context, policy: orderSpec.policy });
    return {
      success: false,
      blocked: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: "open_position",
        policy: orderSpec.policy,
        note: orderSpec.reason,
      },
    };
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
        order: orderSpec.order,
        policy: orderSpec.policy,
        note: "Approval mode: generated exact action intent but did not execute.",
      },
    };
  }

  if (context.mode === "autonomous") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      recordExecutionIncident({ kind: "open_live_readiness_block", symbol: params.symbol, side: params.side, readiness, context });
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
      orders: [orderSpec.order],
      grouping: "na",
    }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

    recordExecutionIncident({ kind: "open_live_submit", symbol: params.symbol, side: params.side, context, policy: orderSpec.policy, orderPreview: orderSpec.order, resultPreview: result?.response?.data?.statuses || result?.data?.statuses || null });
    return {
      success: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: "open_position",
        policy: orderSpec.policy,
        order: orderSpec.order,
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
      order: orderSpec.order,
      policy: orderSpec.policy,
      note: "Dry-run/paper execution recorded through guarded execution seam.",
    },
  };
}

function deriveReduceExecutionPolicy(params = {}) {
  const style = params.executionTactics?.orderStyle || "ioc_limit";
  const aggressionBps = Number(params.executionTactics?.aggressionBps || process.env.HELIX_IOC_SLIPPAGE_BPS || 30);
  const reducePct = Number(params.reducePct || 100);

  if (style === "resting_limit_preferred" && reducePct < 100) {
    return {
      tif: "Gtc",
      orderStyle: "resting_reduce",
      aggressionBps: Math.min(aggressionBps, 15),
      note: "Pullback-style management prefers patient partial reduction.",
    };
  }

  return {
    tif: "Ioc",
    orderStyle: reducePct >= 100 ? "decisive_exit" : "aggressive_reduce",
    aggressionBps,
    note: reducePct >= 100 ? "Full close uses aggressive decisive exit." : "Partial reduce uses aggressive execution by default.",
  };
}

export async function reducePerpPosition({ symbol, side, reducePct = 100, size = null, livePosition = null, executionTactics = null }) {
  const context = buildExecutionContext();
  const account = livePosition ? { positions: [livePosition] } : await getNormalizedAccountState().catch(() => null);
  const risk = validateCloseRisk({ trade: { symbol, side, status: "open" }, account });
  if (!risk.ok) {
    recordExecutionIncident({ kind: reducePct >= 100 ? "close_risk_block" : "reduce_risk_block", symbol, side, reducePct, issues: risk.issues, context });
    return { success: false, blocked: true, risk, context };
  }

  const reducePolicy = deriveReduceExecutionPolicy({ executionTactics, reducePct });

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
        policy: reducePolicy,
        note: "Approval mode: generated exact reduce intent but did not execute.",
      },
    };
  }

  if (context.mode === "autonomous") {
    const readiness = getLiveExecutionReadiness();
    if (!readiness.ready) {
      recordExecutionIncident({ kind: reducePct >= 100 ? "close_live_readiness_block" : "reduce_live_readiness_block", symbol, side, reducePct, readiness, context });
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Autonomous live execution not ready." },
      };
    }

    if (!livePosition || !livePosition.coin || !livePosition.szi) {
      recordExecutionIncident({ kind: reducePct >= 100 ? "close_missing_live_position" : "reduce_missing_live_position", symbol, side, reducePct, context });
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
      recordExecutionIncident({ kind: reducePct >= 100 ? "close_invalid_reduce_payload" : "reduce_invalid_reduce_payload", symbol, side, reducePct, reduceSize, asset: livePosition.asset, context });
      return {
        success: false,
        blocked: true,
        risk,
        context: { ...context, readiness },
        execution: { note: "Missing live asset index or reduce size for reduce-only order." },
      };
    }

    const reduceOrderSpec = await buildOrderSpec({
      asset: Number(livePosition.asset),
      symbol: livePosition.coin || symbol,
      side: closeSideIsBuy ? "long" : "short",
      size: reduceSize,
      price: livePosition.entryPx || null,
      reduceOnly: true,
      policy: reducePolicy,
    });

    if (reduceOrderSpec.blocked) {
      recordExecutionIncident({ kind: reducePct >= 100 ? "close_policy_block" : "reduce_policy_block", symbol, side, reducePct, context, policy: reduceOrderSpec.policy });
      return {
        success: false,
        blocked: true,
        risk,
        context,
        execution: { note: reduceOrderSpec.reason, policy: reduceOrderSpec.policy },
      };
    }

    const result = await exchange.order({
      orders: [reduceOrderSpec.order],
      grouping: "na",
    }, process.env.HYPERLIQUID_ACCOUNT_ADDRESS ? { vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS } : undefined);

    recordExecutionIncident({ kind: reducePct >= 100 ? "close_live_submit" : "reduce_live_submit", symbol, side, reducePct, context, policy: reduceOrderSpec.policy, orderPreview: reduceOrderSpec.order, resultPreview: result?.response?.data?.statuses || result?.data?.statuses || null });
    return {
      success: true,
      risk,
      context,
      execution: {
        mode: context.mode,
        action: reducePct >= 100 ? "close_position" : "reduce_position",
        reducePct,
        policy: reduceOrderSpec.policy,
        order: reduceOrderSpec.order,
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
      policy: reducePolicy,
      note: "Dry-run/paper reduce recorded through guarded execution seam.",
    },
  };
}

export async function closePerpPosition({ trade, livePosition = null, executionTactics = null }) {
  const context = buildExecutionContext();
  const account = livePosition ? { positions: [livePosition] } : await getNormalizedAccountState().catch(() => null);
  const risk = validateCloseRisk({ trade, account });
  if (!risk.ok) {
    recordExecutionIncident({ kind: "close_risk_block", tradeId: trade.tradeId, symbol: trade.symbol, side: trade.side, issues: risk.issues, context });
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
      recordExecutionIncident({ kind: "close_live_readiness_block", tradeId: trade.tradeId, symbol: trade.symbol, side: trade.side, readiness, context });
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
      executionTactics,
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
