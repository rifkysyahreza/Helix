import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_CONFIG_PATH = path.join(__dirname, "user-config.json");

function readUserConfig() {
  if (!fs.existsSync(USER_CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"));
  } catch (error) {
    console.error(`[CONFIG_ERROR] Failed to parse user-config.json: ${error.message}`);
    return {};
  }
}

const u = readUserConfig();

if (u.llmRuntime) process.env.LLM_RUNTIME ||= u.llmRuntime;
if (u.llmModel) process.env.LLM_MODEL ||= u.llmModel;
if (u.llmBaseUrl) process.env.LLM_BASE_URL ||= u.llmBaseUrl;
if (u.llmApiKey) process.env.LLM_API_KEY ||= u.llmApiKey;
if (u.openClawAgentCommand) process.env.OPENCLAW_AGENT_COMMAND ||= u.openClawAgentCommand;
if (u.openClawAgentTimeoutMs) process.env.OPENCLAW_AGENT_TIMEOUT_MS ||= String(u.openClawAgentTimeoutMs);
if (u.openClawAgentSessionPrefix) process.env.OPENCLAW_AGENT_SESSION_PREFIX ||= u.openClawAgentSessionPrefix;
if (u.openClawAgentExtraArgs) process.env.OPENCLAW_AGENT_EXTRA_ARGS ||= u.openClawAgentExtraArgs;
if (u.dryRun !== undefined) process.env.DRY_RUN ||= String(u.dryRun);

export const config = {
  risk: {
    maxConcurrentPositions: u.maxConcurrentPositions ?? 3,
    maxPositionNotionalUsd: u.maxPositionNotionalUsd ?? 500,
    maxTotalExposureUsd: u.maxTotalExposureUsd ?? 1500,
    maxLeverage: u.maxLeverage ?? 3,
    dailyLossLimitUsd: u.dailyLossLimitUsd ?? 150,
  },

  screening: {
    min24hVolumeUsd: u.min24hVolumeUsd ?? 50_000_000,
    minOpenInterestUsd: u.minOpenInterestUsd ?? 5_000_000,
    maxFundingAbsPct: u.maxFundingAbsPct ?? 0.05,
    minTrendScore: u.minTrendScore ?? 0,
    minLiquidityScore: u.minLiquidityScore ?? 0,
    allowedSymbols: u.allowedSymbols ?? [],
    blockedSymbols: u.blockedSymbols ?? [],
    regime: u.regime ?? "trend-following",
    timeframe: u.timeframe ?? "15m",
  },

  execution: {
    dryRun: process.env.DRY_RUN === "true",
    mode: process.env.HELIX_EXECUTION_MODE || u.executionMode || "paper",
    defaultOrderType: u.defaultOrderType ?? "market",
    defaultPositionSizeUsd: u.defaultPositionSizeUsd ?? 150,
    stopLossPct: u.stopLossPct ?? 1.5,
    takeProfitPct: u.takeProfitPct ?? 3,
    trailingStopPct: u.trailingStopPct ?? 1,
    reduceOnSignalFade: u.reduceOnSignalFade ?? true,
  },

  schedule: {
    observerIntervalMin: u.observerIntervalMin ?? 5,
    plannerIntervalMin: u.plannerIntervalMin ?? 15,
    reviewIntervalMin: u.reviewIntervalMin ?? 60,
  },

  llm: {
    runtime: u.llmRuntime ?? process.env.LLM_RUNTIME ?? "openai-chat",
    temperature: u.temperature ?? 0.25,
    maxTokens: u.maxTokens ?? 4096,
    maxSteps: u.maxSteps ?? 16,
    traderModel: u.traderModel ?? process.env.LLM_MODEL ?? process.env.OPENCLAW_MODEL ?? "openai-codex/gpt-5.4",
    reviewerModel: u.reviewerModel ?? process.env.LLM_MODEL ?? process.env.OPENCLAW_MODEL ?? "openai-codex/gpt-5.4",
    generalModel: u.generalModel ?? process.env.LLM_MODEL ?? process.env.OPENCLAW_MODEL ?? "openai-codex/gpt-5.4",
  },
};
