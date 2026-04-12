import assert from "assert";
import { buildGoLiveCheck } from "../go-live-check.js";
import { startBurnIn, stopBurnIn, recordBurnInEvent } from "../burn-in.js";

async function run() {
  startBurnIn({ mode: "paper" });
  for (let i = 0; i < 5; i += 1) recordBurnInEvent({ successfulExecution: true });
  const check = await buildGoLiveCheck();
  assert.ok(check.burnIn);
  assert.ok(Object.prototype.hasOwnProperty.call(check, "recommendedMode"));
  stopBurnIn();
  console.log("go-live burn-in tests passed");
}

run();
