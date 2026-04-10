import { nextNonce } from "./nonce-manager.js";
import { buildOrderAction, buildExchangePayload } from "./hyperliquid-exchange.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for live execution.`);
  }
  return value;
}

function detectLibraryReadiness() {
  return {
    ready: true,
    missing: [],
  };
}

export function getLiveExecutionReadiness() {
  const enabled = process.env.HELIX_ENABLE_LIVE_EXECUTION === "true";
  const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS || null;
  const agentWalletAddress = process.env.HYPERLIQUID_AGENT_WALLET_ADDRESS || null;
  const agentWalletPrivateKey = process.env.HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY || null;

  const missing = [];
  if (!accountAddress) missing.push("HYPERLIQUID_ACCOUNT_ADDRESS");
  if (!agentWalletAddress) missing.push("HYPERLIQUID_AGENT_WALLET_ADDRESS");
  if (!agentWalletPrivateKey) missing.push("HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY");

  const libraries = detectLibraryReadiness();

  return {
    enabled,
    ready: enabled && missing.length === 0 && libraries.ready,
    missing,
    accountAddress,
    agentWalletAddress,
    libraries,
  };
}

function buildOrderIntent({ symbol, side, sizeUsd, leverage }) {
  return {
    symbol,
    side,
    sizeUsd,
    leverage,
    nonce: nextNonce(),
    timestamp: Date.now(),
  };
}

function buildUnsignedOrderPayload({ symbol, side, sizeUsd, leverage }) {
  const action = buildOrderAction({
    asset: 0,
    isBuy: side === "long",
    price: 0,
    size: sizeUsd,
    reduceOnly: false,
    tif: "Ioc",
  });

  return buildExchangePayload({
    action,
    signature: {
      r: "0x",
      s: "0x",
      v: 0,
    },
    vaultAddress: process.env.HYPERLIQUID_ACCOUNT_ADDRESS || undefined,
  });
}

export async function submitLiveOpenOrder({ symbol, side, sizeUsd, leverage }) {
  const readiness = getLiveExecutionReadiness();
  if (!readiness.enabled) {
    return {
      success: false,
      blocked: true,
      reason: "live_execution_disabled",
      readiness,
    };
  }
  if (!readiness.ready) {
    return {
      success: false,
      blocked: true,
      reason: "live_execution_not_ready",
      readiness,
    };
  }

  requireEnv("HYPERLIQUID_ACCOUNT_ADDRESS");
  requireEnv("HYPERLIQUID_AGENT_WALLET_ADDRESS");
  requireEnv("HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY");

  const orderIntent = buildOrderIntent({ symbol, side, sizeUsd, leverage });
  const unsignedPayload = buildUnsignedOrderPayload({ symbol, side, sizeUsd, leverage });

  return {
    success: true,
    submitted: false,
    mode: "live-guarded",
    note: "Order payload skeleton, exchange payload structure, and nonce generation are ready. Final Hyperliquid signature construction is still gated until protocol hash/sign rules are implemented exactly.",
    orderIntent,
    unsignedPayload,
    readiness,
  };
}

export async function submitLiveCloseOrder({ trade }) {
  const readiness = getLiveExecutionReadiness();
  if (!readiness.enabled) {
    return {
      success: false,
      blocked: true,
      reason: "live_execution_disabled",
      readiness,
    };
  }
  if (!readiness.ready) {
    return {
      success: false,
      blocked: true,
      reason: "live_execution_not_ready",
      readiness,
    };
  }

  requireEnv("HYPERLIQUID_ACCOUNT_ADDRESS");
  requireEnv("HYPERLIQUID_AGENT_WALLET_ADDRESS");
  requireEnv("HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY");

  return {
    success: true,
    submitted: false,
    mode: "live-guarded",
    note: "Close payload skeleton and nonce generation are ready, but final Hyperliquid signing/submission code still requires protocol-verified signature construction.",
    closeIntent: {
      tradeId: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
      nonce: nextNonce(),
      timestamp: Date.now(),
    },
    readiness,
  };
}
