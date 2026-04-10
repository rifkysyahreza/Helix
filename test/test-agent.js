import "dotenv/config";
import { agentLoop } from "../agent.js";

async function main() {
  console.log("=== Testing Helix Agent Loop (DRY RUN) ===\n");

  const result = await agentLoop(
    "Use tools to inspect current market context, rank the best futures setups, and summarize the top idea.",
    5,
    [],
    "TRADER",
    null,
    null,
    { requireTool: true },
  );

  console.log("\n=== Agent Response ===");
  console.log(result);
  console.log("\n=== Test complete ===");
}

main().catch(console.error);
