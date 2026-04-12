export function validateReplayableIntent(intent) {
  if (!intent?.intent?.type) {
    return { ok: false, error: "Missing executable intent payload." };
  }

  if (intent.status !== "pending") {
    return { ok: false, error: `Intent is not pending anymore: ${intent.status}` };
  }

  if (intent.expiresAt && Date.now() > new Date(intent.expiresAt).getTime()) {
    return { ok: false, error: "Intent expired before replay.", expiresAt: intent.expiresAt };
  }

  return { ok: true };
}
