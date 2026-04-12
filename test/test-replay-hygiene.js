import assert from "assert";
import { validateReplayableIntent } from "../replay-guards.js";

function run() {
  const expired = validateReplayableIntent({
    status: "pending",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    intent: { type: "open_position", symbol: "BTC", side: "long", sizeUsd: 10 },
  });

  assert.equal(expired.ok, false);
  assert.equal(expired.error, "Intent expired before replay.");

  const resolved = validateReplayableIntent({
    status: "approved",
    intent: { type: "open_position", symbol: "BTC", side: "long", sizeUsd: 10 },
  });

  assert.equal(resolved.ok, false);
  assert(resolved.error.includes("not pending"));

  const missingPayload = validateReplayableIntent({ status: "pending" });
  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.error, "Missing executable intent payload.");

  const valid = validateReplayableIntent({
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    intent: { type: "close_position", symbol: "BTC" },
  });
  assert.equal(valid.ok, true);

  console.log("replay hygiene tests passed");
}

run();
