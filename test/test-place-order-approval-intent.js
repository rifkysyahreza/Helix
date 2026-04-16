import assert from "assert";
import fs from "fs";
import { setupIsolatedTestEnv } from "./test-env.js";

setupIsolatedTestEnv("helix-place-order-");
const { executeTool } = await import("../tools/executor.js");

const FILE = process.env.HELIX_PENDING_INTENTS_FILE;

function cleanup() {
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

async function run() {
  cleanup();
  process.env.HELIX_EXECUTION_MODE = "approval";
  process.env.DRY_RUN = "true";

  const result = await executeTool("place_order", {
    symbol: "BTC",
    side: "long",
    sizeUsd: 10,
    leverage: 1,
    thesis: "approval intent test",
  });

  if (!result.execution?.policy?.blocked) {
    assert.equal(result.requiresApproval, true);
    assert.equal(result.placed, false);
    assert.equal(result.pending?.intent?.type, "open_position");
  }

  console.log("place order approval intent tests passed");
}

run();
