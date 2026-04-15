import "dotenv/config";
import cron from "node-cron";
import readline from "readline";
import { preflightRuntime } from "./llm/runtime.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { agentLoop } from "./agent.js";
import { buildHealthSummary } from "./health-summary.js";
import { haltTrading, resumeTrading, setCloseOnly, suspendSymbol, unsuspendSymbol, getOperatorControls } from "./operator-controls.js";
import { runAutonomousManagementPass } from "./autonomous-manager.js";
import { markRuntimeStart, markRuntimeHeartbeat, evaluateRuntimeWatchdog } from "./runtime-resilience.js";
import { runStartupRecovery } from "./startup-recovery.js";
import { ensureManagedStreams } from "./stream-watchlist-manager.js";
import { repairStreamHealth, evaluateStreamHealth } from "./stream-health.js";
import { buildBurnInRunbookStatus } from "./burn-in-runbook.js";
import { buildFirstPaperBurnInPlan } from "./burn-in-session-plan.js";

log("startup", "Helix starting...");
const runtimeResilience = markRuntimeStart();
log("startup", `Runtime resilience: ${JSON.stringify(runtimeResilience)}`);
runStartupRecovery({ autoAct: config.execution.mode === "autonomous" })
  .then((result) => log("startup", `Startup recovery: ${JSON.stringify({ recovered: result.recovered, reason: result.reason || null })}`))
  .catch((error) => log("startup", `Startup recovery failed: ${error.message}`));
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

const cycleState = {
  observer: false,
  planner: false,
  review: false,
  management: false,
  llmGlobal: false,
};

async function runSingleFlightCycle(name, fn, { requiresGlobalLlm = true } = {}) {
  if (cycleState[name]) {
    log("cron", `${name} cycle skipped (already running)`);
    return { skipped: true, reason: "already_running" };
  }
  if (requiresGlobalLlm && cycleState.llmGlobal) {
    log("cron", `${name} cycle skipped (global llm cycle busy)`);
    return { skipped: true, reason: "global_llm_busy" };
  }

  cycleState[name] = true;
  if (requiresGlobalLlm) cycleState.llmGlobal = true;

  try {
    return await fn();
  } finally {
    cycleState[name] = false;
    if (requiresGlobalLlm) cycleState.llmGlobal = false;
  }
}

async function runObserverCycle() {
  return runSingleFlightCycle("observer", async () => {
    markRuntimeHeartbeat();
    await ensureManagedStreams().catch((error) => log("cron", `Managed stream refresh failed: ${error.message}`));
    const streamRepair = await repairStreamHealth().catch((error) => ({ error: error.message }));
    log("cron", `Observer cycle (streamHealthy=${streamRepair?.health?.healthy ?? !streamRepair?.error})`);
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
    return result;
  });
}

async function runPlannerCycle() {
  return runSingleFlightCycle("planner", async () => {
    markRuntimeHeartbeat();
    log("cron", "Planner cycle");
    const result = await agentLoop(
      "Review current Hyperliquid futures context, update ranked trade ideas, and summarize the best conditional plans right now.",
      config.llm.maxSteps,
      [],
      "TRADER",
      config.llm.traderModel,
      null,
      { requireTool: true },
    );
    log("cycle", `Planner result: ${(result.content || "").slice(0, 300)}`);
    return result;
  });
}

async function runReviewCycle() {
  return runSingleFlightCycle("review", async () => {
    markRuntimeHeartbeat();
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
    return result;
  });
}

async function runManagementCycle() {
  return runSingleFlightCycle("management", async () => {
    markRuntimeHeartbeat();
    const watchdog = evaluateRuntimeWatchdog();
    log("cron", `Management cycle (watchdog stale=${watchdog.stale})`);
    const maintenance = await runAutonomousManagementPass({ autoAct: true }).catch((error) => ({ error: error.message }));
    log("cycle", `Management maintenance: ${JSON.stringify(maintenance).slice(0, 300)}`);

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
    return result;
  });
}

cron.schedule(`*/${config.schedule.observerIntervalMin} * * * *`, () => {
  runObserverCycle().catch((error) => log("cron_error", `Observer cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.plannerIntervalMin} * * * *`, () => {
  runPlannerCycle().catch((error) => log("cron_error", `Planner cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.reviewIntervalMin} * * * *`, () => {
  runReviewCycle().catch((error) => log("cron_error", `Review cycle failed: ${error.message}`));
});

cron.schedule(`*/${config.schedule.observerIntervalMin} * * * *`, () => {
  runManagementCycle().catch((error) => log("cron_error", `Management cycle failed: ${error.message}`));
});

console.log("\nHelix runtime is live.");
console.log("Commands: /status, /health, /audit, /drill, /burn-in start [paper|approval], /burn-in stop, /burn-in status, /burn-in runbook, /burn-in plan, /watch, /manage, /maintain, /pending, /review, /sync, /halt, /resume, /close-only on|off, /suspend <symbol>, /unsuspend <symbol>, /paper-long <symbol>, /paper-short <symbol>, /stop\n");

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
        executionMode: config.execution.mode,
        schedule: config.schedule,
        operatorControls: getOperatorControls(),
        runtimeResilience: evaluateRuntimeWatchdog(),
        managedStreams: await ensureManagedStreams().catch(() => null),
        streamHealth: evaluateStreamHealth(),
      }, null, 2));
    } else if (input === "/health") {
      console.log(JSON.stringify(await buildHealthSummary({ limit: 100 }), null, 2));
    } else if (input === "/audit") {
      const result = await agentLoop(
        "Inspect Helix execution reliability, lifecycle phases, and recent incidents, then summarize what looks weak or dangerous.",
        config.llm.maxSteps,
        [],
        "REVIEWER",
        config.llm.reviewerModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input === "/drill") {
      const result = await agentLoop(
        "Run the Helix operator drill and summarize any broken control, reconcile, burn-in, or execution audit surface.",
        config.llm.maxSteps,
        [],
        "REVIEWER",
        config.llm.reviewerModel,
        null,
        { requireTool: true },
      );
      console.log(result.content || "No response.");
    } else if (input.startsWith("/burn-in start")) {
      const mode = input.includes("approval") ? "approval" : "paper";
      console.log(JSON.stringify({ ok: true, mode, note: "Use tool path start_burn_in during agent flows for structured tracking." }, null, 2));
    } else if (input === "/burn-in stop") {
      console.log(JSON.stringify({ ok: true, note: "Use tool path stop_burn_in during agent flows for structured tracking." }, null, 2));
    } else if (input === "/burn-in status") {
      console.log(JSON.stringify(await buildHealthSummary({ limit: 50 }), null, 2));
    } else if (input === "/burn-in runbook") {
      console.log(JSON.stringify(await buildBurnInRunbookStatus(), null, 2));
    } else if (input === "/burn-in plan") {
      console.log(JSON.stringify(await buildFirstPaperBurnInPlan(), null, 2));
    } else if (input === "/halt") {
      console.log(JSON.stringify(haltTrading("manual_repl_halt"), null, 2));
    } else if (input === "/resume") {
      console.log(JSON.stringify(resumeTrading(), null, 2));
    } else if (input === "/close-only on") {
      console.log(JSON.stringify(setCloseOnly(true, "manual_repl_close_only"), null, 2));
    } else if (input === "/close-only off") {
      console.log(JSON.stringify(setCloseOnly(false), null, 2));
    } else if (input.startsWith("/suspend ")) {
      const symbol = input.replace("/suspend ", "").trim().toUpperCase();
      console.log(JSON.stringify(suspendSymbol(symbol, "manual_repl_suspend"), null, 2));
    } else if (input.startsWith("/unsuspend ")) {
      const symbol = input.replace("/unsuspend ", "").trim().toUpperCase();
      console.log(JSON.stringify(unsuspendSymbol(symbol), null, 2));
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
    } else if (input === "/maintain") {
      console.log(JSON.stringify(await runAutonomousManagementPass({ autoAct: true }), null, 2));
    } else if (input === "/pending") {
      const result = await agentLoop(
        "List current pending Helix approval intents and summarize the most urgent ones.",
        config.llm.maxSteps,
        [],
        "REVIEWER",
        config.llm.reviewerModel,
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
