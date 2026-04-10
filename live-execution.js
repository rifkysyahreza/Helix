import { nextNonce } from "./nonce-manager.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for live execution.`);
  }
  return value;
}

function detectLibraryReadiness() {
  try {
    const bs58 = requireModule("bs58");
    const hashes = requireModule("@noble/hashes/sha3");
    return {
      ready: Boolean(bs58 && hashes),
      missing: [],
    };
  } catch (error) {
    return {
      ready: false,
      missing: [error.message],
    };
  }
}

function requireModule(name) {
  throw new Error(`Dependency not installed for live execution: ${name}. Run npm install first.`);
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

  return {
    success: true,
    submitted: false,
    mode: "live-guarded",
    note: "Order payload skeleton and nonce generation are ready, but final Hyperliquid signing/submission code still requires installed crypto deps plus protocol-verified implementation.",
    orderIntent,
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
    note: "Close payload skeleton and nonce generation are ready, but final Hyperliquid signing/submission code still requires installed crypto deps plus protocol-verified implementation.",
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
