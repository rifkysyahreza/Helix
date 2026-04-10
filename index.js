import "dotenv/config";
import cron from "node-cron";
import readline from "readline";
import { preflightRuntime } from "./llm/runtime.js";
import { config } from "./config.js";
import { log } from "./logger.js";

log("startup", "Helix starting...");
log("startup", `Mode: ${process.env.DRY_RUN === "true" ? "DRY RUN" : "LIVE"}`);
log("startup", `LLM runtime: ${config.llm.runtime}`);
log("startup", `Model: ${process.env.LLM_MODEL || process.env.OPENCLAW_MODEL || "openai-codex/gpt-5.4"}`);

if (config.llm.runtime === "openclaw-codex") {
  log("startup", `OpenClaw command: ${process.env.OPENCLAW_AGENT_COMMAND || "openclaw"}`);
  log("startup", `OpenClaw session prefix: ${process.env.OPENCLAW_AGENT_SESSION_PREFIX || "helix-openclaw-bridge"}`);
}

try {
  const preflight = await preflightRuntime({ mode: config.llm.runtime });
  if (config.llm.runtime === "openclaw-codex") {
    log("startup", `OpenClaw preflight ok (session=${preflight.sessionId || "n/a"})`);
  }
} catch (error) {
  log("startup_error", `Runtime preflight failed: ${error.message}`);
  process.exit(1);
}

function buildPrompt() {
  return "[helix observer/planner shell]\n> ";
}

function printRoadmap() {
  console.log("\nHelix scaffold is live.");
  console.log("Current focus:");
  console.log("- Hyperliquid market observer");
  console.log("- Setup planner");
  console.log("- Trade journal");
  console.log("- Post-trade self-review");
  console.log("- Safe dry-run execution layer\n");
}

cron.schedule(`*/${config.schedule.observerIntervalMin} * * * *`, () => {
  log("cron", "Observer tick placeholder");
});

cron.schedule(`*/${config.schedule.plannerIntervalMin} * * * *`, () => {
  log("cron", "Planner tick placeholder");
});

cron.schedule(`*/${config.schedule.reviewIntervalMin} * * * *`, () => {
  log("cron", "Review tick placeholder");
});

printRoadmap();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: buildPrompt(),
});

rl.prompt();
rl.on("line", (line) => {
  const input = line.trim();
  if (input === "/stop" || input === "exit") {
    rl.close();
    return;
  }
  if (input === "/status") {
    console.log(JSON.stringify({
      runtime: config.llm.runtime,
      model: process.env.LLM_MODEL || process.env.OPENCLAW_MODEL || null,
      dryRun: process.env.DRY_RUN === "true",
      schedule: config.schedule,
    }, null, 2));
  } else {
    console.log("Helix scaffold is not fully wired yet. Next step is implementing Hyperliquid-specific tools and planner flow.");
  }
  rl.prompt();
}).on("close", () => {
  log("shutdown", "Helix stopped.");
  process.exit(0);
});
