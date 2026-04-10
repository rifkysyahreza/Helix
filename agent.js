import { buildSystemPrompt } from "./prompt.js";
import { log } from "./logger.js";
import { config } from "./config.js";
import { createRuntime } from "./llm/runtime.js";

const runtime = createRuntime();
const DEFAULT_MODEL = process.env.LLM_MODEL || process.env.OPENCLAW_MODEL || "openai-codex/gpt-5.4";

export async function agentLoop(goal, maxSteps = config.llm.maxSteps, sessionHistory = [], agentType = "GENERAL", model = null) {
  const systemPrompt = buildSystemPrompt(agentType, {}, {}, {}, null, null);
  const messages = [
    { role: "system", content: systemPrompt },
    ...sessionHistory,
    { role: "user", content: goal },
  ];

  log("agent", `Starting ${agentType} loop with maxSteps=${maxSteps}`);

  const response = await runtime.complete({
    model: model || DEFAULT_MODEL,
    messages,
    tools: [],
    toolChoice: "auto",
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
  });

  if (!response?.message) {
    throw new Error("Helix runtime returned no message.");
  }

  return {
    content: response.message.content || "",
    raw: response.raw,
  };
}
