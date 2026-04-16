import assert from "assert";
import { executeTool } from "../tools/executor.js";

async function run() {
  process.env.HELIX_EXECUTION_MODE = "approval";
  process.env.DRY_RUN = "true";

  const proposal = await executeTool("propose_trade", { symbol: "BTC" });
  assert.equal(proposal.mode, "approval");
  console.log("propose trade mode truth tests passed");
}

run();
