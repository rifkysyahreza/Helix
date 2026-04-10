let lastNonce = 0;

export function nextNonce() {
  const now = Date.now();
  lastNonce = Math.max(lastNonce + 1, now);
  return lastNonce;
}

export function resetNonce(seed = 0) {
  lastNonce = seed;
}
