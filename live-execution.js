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
