import { nextNonce } from "./nonce-manager.js";

const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

export async function postExchange(payload) {
  const response = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export function buildOrderAction({ asset, isBuy, price, size, reduceOnly = false, tif = "Ioc", cloid = undefined }) {
  return {
    type: "order",
    orders: [
      {
        a: asset,
        b: isBuy,
        p: String(price),
        s: String(size),
        r: reduceOnly,
        t: { limit: { tif } },
        ...(cloid ? { c: cloid } : {}),
      },
    ],
    grouping: "na",
  };
}

export function buildExchangePayload({ action, signature, vaultAddress, expiresAfter }) {
  return {
    action,
    nonce: nextNonce(),
    signature,
    ...(vaultAddress ? { vaultAddress } : {}),
    ...(expiresAfter ? { expiresAfter } : {}),
  };
}
