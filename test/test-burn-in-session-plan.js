import assert from "assert";
import { buildFirstPaperBurnInPlan } from "../burn-in-session-plan.js";

async function run() {
  const plan = await buildFirstPaperBurnInPlan();
  assert.equal(plan.stage, "paper");
  assert.ok(Array.isArray(plan.commands));
  assert.ok(plan.commands.includes("/status"));
  console.log("burn-in session plan tests passed");
}

run();
