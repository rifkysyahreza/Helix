import {
  HttpTransport,
  InfoClient,
  ExchangeClient,
  MAINNET_API_URL,
  TESTNET_API_URL,
} from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

function isTestnet() {
  return process.env.HYPERLIQUID_USE_TESTNET === "true";
}

function apiUrl() {
  return process.env.HYPERLIQUID_API_URL || (isTestnet() ? TESTNET_API_URL : MAINNET_API_URL);
}

export function createInfoClient() {
  const transport = new HttpTransport({ url: apiUrl() });
  return new InfoClient({ transport });
}

export function createExchangeClient() {
  const privateKey = process.env.HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY is required for exchange client.");
  }

  const wallet = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const transport = new HttpTransport({ url: apiUrl() });
  return new ExchangeClient({ transport, wallet });
}
