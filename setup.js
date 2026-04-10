import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "user-config.json");
const ENV_PATH = path.join(__dirname, ".env");

const DEFAULT_MODEL = "openai-codex/gpt-5.4";
const DEFAULT_OPENCLAW_COMMAND = "openclaw";

const RUNTIMES = [
  { label: "OpenAI-compatible", key: "openai-chat" },
  { label: "OpenClaw/Codex local bridge", key: "openclaw-codex" },
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
  return new Promise((resolve) => {
    const hint = defaultVal !== undefined && defaultVal !== "" ? ` (default: ${defaultVal})` : "";
    rl.question(`${question}${hint}: `, (ans) => {
      const trimmed = ans.trim();
      resolve(trimmed === "" ? defaultVal : trimmed);
    });
  });
}

function askNum(question, defaultVal, { min, max } = {}) {
  return new Promise(async (resolve) => {
    while (true) {
      const raw = await ask(question, defaultVal);
      const n = parseFloat(raw);
      if (Number.isNaN(n)) { console.log("  ⚠ Please enter a number."); continue; }
      if (min !== undefined && n < min) { console.log(`  ⚠ Minimum is ${min}.`); continue; }
      if (max !== undefined && n > max) { console.log(`  ⚠ Maximum is ${max}.`); continue; }
      resolve(n);
      break;
    }
  });
}

function askChoice(question, choices) {
  return new Promise(async (resolve) => {
    console.log(`\n${question}`);
    choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice.label}`));
    while (true) {
      const raw = await ask("Enter number", "1");
      const idx = parseInt(raw, 10) - 1;
      if (idx >= 0 && idx < choices.length) return resolve(choices[idx]);
      console.log("  ⚠ Invalid choice.");
    }
  });
}

function parseEnv(content) {
  const map = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return map;
}

function buildEnv(map) {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

const existingConfig = fs.existsSync(CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"))
  : {};
const existingEnv = fs.existsSync(ENV_PATH)
  ? parseEnv(fs.readFileSync(ENV_PATH, "utf8"))
  : {};

console.log(`
╔═══════════════════════════════════════════════╗
║                 Helix Setup                  ║
║      Hyperliquid futures sibling of Meridian ║
╚═══════════════════════════════════════════════╝
`);

const runtimeChoice = await askChoice("Choose runtime", RUNTIMES);
const accountAddress = await ask("Hyperliquid account address", existingEnv.HYPERLIQUID_ACCOUNT_ADDRESS || existingConfig.hyperliquidAccountAddress || "");
const apiUrl = await ask("Hyperliquid info API URL", existingEnv.HYPERLIQUID_API_URL || "https://api.hyperliquid.xyz/info");
const wsUrl = await ask("Hyperliquid websocket URL (optional)", existingEnv.HYPERLIQUID_WS_URL || "");
const dryRun = await ask("Dry run mode", String(existingEnv.DRY_RUN || existingConfig.dryRun || true));
const timeframe = await ask("Screening timeframe", String(existingConfig.timeframe || "15m"));
const volume = await askNum("Minimum 24h volume USD", existingConfig.min24hVolumeUsd || 50000000, { min: 0 });
const oi = await askNum("Minimum open interest USD", existingConfig.minOpenInterestUsd || 5000000, { min: 0 });
const leverage = await askNum("Max leverage", existingConfig.maxLeverage || 3, { min: 1, max: 20 });
const size = await askNum("Default position size USD", existingConfig.defaultPositionSizeUsd || 150, { min: 1 });

const envMap = {
  ...existingEnv,
  HYPERLIQUID_API_URL: apiUrl,
  HYPERLIQUID_WS_URL: wsUrl,
  HYPERLIQUID_ACCOUNT_ADDRESS: accountAddress,
  DRY_RUN: String(dryRun),
  LLM_RUNTIME: runtimeChoice.key,
};

if (runtimeChoice.key === "openclaw-codex") {
  envMap.OPENCLAW_AGENT_COMMAND = existingEnv.OPENCLAW_AGENT_COMMAND || DEFAULT_OPENCLAW_COMMAND;
  envMap.OPENCLAW_AGENT_TIMEOUT_MS = existingEnv.OPENCLAW_AGENT_TIMEOUT_MS || "300000";
  envMap.OPENCLAW_AGENT_SESSION_PREFIX = existingEnv.OPENCLAW_AGENT_SESSION_PREFIX || "helix-openclaw-bridge";
  envMap.OPENCLAW_AGENT_EXTRA_ARGS = existingEnv.OPENCLAW_AGENT_EXTRA_ARGS || "--thinking low";
  envMap.OPENCLAW_MODEL = existingEnv.OPENCLAW_MODEL || DEFAULT_MODEL;
  envMap.LLM_MODEL = existingEnv.LLM_MODEL || DEFAULT_MODEL;
} else {
  envMap.LLM_MODEL = existingEnv.LLM_MODEL || DEFAULT_MODEL;
}

const userConfig = {
  ...existingConfig,
  dryRun: String(dryRun) === "true",
  llmRuntime: runtimeChoice.key,
  llmModel: envMap.LLM_MODEL,
  hyperliquidAccountAddress: accountAddress,
  min24hVolumeUsd: volume,
  minOpenInterestUsd: oi,
  maxLeverage: leverage,
  defaultPositionSizeUsd: size,
  timeframe,
};

fs.writeFileSync(ENV_PATH, buildEnv(envMap));
fs.writeFileSync(CONFIG_PATH, JSON.stringify(userConfig, null, 2));

console.log("\n✓ Wrote .env and user-config.json");
console.log("Next:");
console.log("  npm run test:openclaw-smoke");
console.log("  npm run dev");

rl.close();
