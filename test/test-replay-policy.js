import assert from "assert";
import { classifyReplay } from "../replay-policy.js";

function run() {
  const allowed = classifyReplay({ id: "intent-1", status: "pending", intent: { type: "open_position" } });
  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.retryClass, "single_attempt_only");

  const deniedStatus = classifyReplay({ id: "intent-2", status: "approved", intent: { type: "open_position" } });
  assert.equal(deniedStatus.decision, "deny");
  assert.equal(deniedStatus.reason, "intent_not_pending");

  const deniedReplay = classifyReplay({ id: "intent-3", status: "pending", replayAttemptedAt: new Date().toISOString(), intent: { type: "close_position" } });
  assert.equal(deniedReplay.decision, "deny");
  assert.equal(deniedReplay.reason, "replay_already_attempted");

  console.log("replay policy tests passed");
}

run();
