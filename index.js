import "dotenv/config";
import cron from "node-cron";
import readline from "readline";
import { preflightRuntime } from "./llm/runtime.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { agentLoop } from "./agent.js";

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

async function runObserverCycle() {
  log("cron", "Observer cycle");
  const result = await agentLoop(
    "Check current market context and summarize the top futures setups worth watching right now.",
    config.llm.maxSteps,
    [],
    "TRADER",
    config.llm.traderModel,
    null,
    { requireTool: true },
  );
  log("cycle", `Observer result: ${(result.content || "").slice(0, 300)}`);
}

async function runReviewCycle() {
  log("cron", "Review cycle");
  const result = await agentLoop(
    "Review recent Helix journal notes and summarize the most important lessons.",
    config.llm.maxSteps,
    [],
    "REVIEWER",
    config.llm.reviewerModel,
    null,
    { requireTool: true },
  );
  log("cycle", `Review result: ${(result.content || "").slice(0, 300)}`);
}

async function runManagementCycle() {
  log("cron", "Management cycle");
  const result = await agentLoop(
    "Evaluate current open Hyperliquid positions, suggest hold/reduce/close actions, and summarize what matters most right now.",
    config.llm.maxSteps,
    [],
    "TRADER",
    config.llm.traderModel,
    null,
    { requireTool: true },
  );
  log("cycle", `Management result: ${(result.content || "").slice(0, 300)}`);
}

cron.schedule(`*/${config.schedule.observerIntervalMin} * * * *`, () => {
  runObserverCycle().catch((error) => log("cron_error", `Observer cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.plannerIntervalMin} * * * *`, () => {
  runObserverCycle().catch((error) => log("cron_error", `Planner cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.reviewIntervalMin} * * * *`, () => {
  runReviewCycle().catch((error) => log("cron_error", `Review cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.observerIntervalMin} * * * *`, () => {
  runManagementCycle().catch((error) => log("cron_error", `Management cycle failed: ${error.message}`));
});

console.log("\nHelix ReAct scaffold is live.");
console.log("Commands: /status, /watch, /manage, /review, /sync, /paper-long <symbol>, /paper-short <symbol>, /stop\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "[helix]\n> ",
});

rl.prompt();
rl.on("line", async (line) => {
  const input = line.trim();
  if (input === "/stop" || input === "exit") {
    rl.close();
    return;
  }

  try {
    if (input === "/status") {
      console.log(JSON.stringify({
        runtime: config.llm.runtime,
        model: process.env.LLM_MODEL || process.env.OPENCLAW_MODEL || null,
        dryRun: process.env.DRY_RUN === "true",
        schedule: config.schedule,
      }, null, 2));
    } else if (input === "/watch") {
      const result = await agentLoop(
        "Check market context and rank current Hyperliquid futures setups worth watching.",
        config.llm.maxSteps,
        [],
        "TRADER",
        config.llm.traderModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input === "/review") {
      const result = await agentLoop(
        "Review recent Helix journal notes and summarize lessons.",
        config.llm.maxSteps,
        [],
        "REVIEWER",
        config.llm.reviewerModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input === "/manage") {
      const result = await agentLoop(
        "Evaluate current open Hyperliquid positions, suggest hold/reduce/close actions, and summarize what matters most right now.",
        config.llm.maxSteps,
        [],
        "TRADER",
        config.llm.traderModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input === "/sync") {
      const result = await agentLoop(
        "Sync Helix trade records with real Hyperliquid exchange state and summarize what changed.",
        config.llm.maxSteps,
        [],
        "REVIEWER",
        config.llm.reviewerModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input.startsWith("/paper-long ")) {
      const symbol = input.replace("/paper-long ", "").trim().toUpperCase();
      const result = await agentLoop(
        `Create a trade plan for ${symbol}, then place a dry-run long order using the plan and summarize what was recorded.`,
        config.llm.maxSteps,
        [],
        "TRADER",
        config.llm.traderModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input.startsWith("/paper-short ")) {
      const symbol = input.replace("/paper-short ", "").trim().toUpperCase();
      const result = await agentLoop(
        `Create a trade plan for ${symbol}, then place a dry-run short order using the plan and summarize what was recorded.`,
        config.llm.maxSteps,
        [],
        "TRADER",
        config.llm.traderModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else {
      const result = await agentLoop(input, config.llm.maxSteps, [], "GENERAL", config.llm.generalModel);
      console.log(result.content || "No response.");
    }
  } catch (error) {
    log("repl_error", error.message);
    console.error(error.message);
  }

  rl.prompt();
}).on("close", () => {
  log("shutdown", "Helix stopped.");
  process.exit(0);
});
