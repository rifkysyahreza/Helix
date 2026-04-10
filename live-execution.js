function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for live execution.`);
  }
  return value;
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

  return {
    enabled,
    ready: enabled && missing.length === 0,
    missing,
    accountAddress,
    agentWalletAddress,
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

  return {
    success: true,
    submitted: false,
    mode: "live-guarded",
    note: "Live Hyperliquid order submission seam is enabled but exact signing payload is not finalized yet. This call proves readiness, not final exchange submission.",
    orderIntent: {
      symbol,
      side,
      sizeUsd,
      leverage,
    },
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
    note: "Live Hyperliquid close submission seam is enabled but exact signing payload is not finalized yet. This call proves readiness, not final exchange submission.",
    closeIntent: {
      tradeId: trade.tradeId,
      symbol: trade.symbol,
      side: trade.side,
    },
    readiness,
  };
}
