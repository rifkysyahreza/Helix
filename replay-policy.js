export const REPLAY_DECISIONS = {
  ALLOW: "allow",
  DENY: "deny",
};

export function classifyReplay(intent) {
  const type = intent?.intent?.type || null;
  const status = intent?.status || null;

  if (!type) {
    return { decision: REPLAY_DECISIONS.DENY, reason: "missing_intent_type", retryClass: "never" };
  }

  if (status !== "pending") {
    return { decision: REPLAY_DECISIONS.DENY, reason: "intent_not_pending", retryClass: "never" };
  }

  if (intent?.replayAttemptedAt) {
    return { decision: REPLAY_DECISIONS.DENY, reason: "replay_already_attempted", retryClass: "never" };
  }

  if (intent?.expiresAt && Date.now() > new Date(intent.expiresAt).getTime()) {
    return { decision: REPLAY_DECISIONS.DENY, reason: "intent_expired", retryClass: "never" };
  }

  if (["open_position", "reduce_position", "close_position"].includes(type)) {
    return { decision: REPLAY_DECISIONS.ALLOW, reason: "replayable", retryClass: "single_attempt_only", idempotencyKey: intent.id || null };
  }

  return { decision: REPLAY_DECISIONS.DENY, reason: "unsupported_intent_type", retryClass: "never" };
}
