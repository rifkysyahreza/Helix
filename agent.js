import { jsonrepair } from "jsonrepair";
import { buildSystemPrompt } from "./prompt.js";
import { executeTool } from "./tools/executor.js";
import { tools } from "./tools/definitions.js";
import { log } from "./logger.js";
import { config } from "./config.js";
import { createRuntime } from "./llm/runtime.js";

const runtime = createRuntime();
const DEFAULT_MODEL = process.env.LLM_MODEL || process.env.OPENCLAW_MODEL || "openai-codex/gpt-5.4";

const TOOL_REQUIRED_INTENTS = /\b(rank|screen|setup|market|funding|open interest|trade|plan|journal|review|position|account)\b/i;

export async function agentLoop(goal, maxSteps = config.llm.maxSteps, sessionHistory = [], agentType = "GENERAL", model = null, maxOutputTokens = null, options = {}) {
  const { requireTool = false } = options;
  const systemPrompt = buildSystemPrompt(agentType, {}, {}, {}, null, null);
  const messages = [
    { role: "system", content: systemPrompt },
    ...sessionHistory,
    { role: "user", content: goal },
  ];

  const mustUseRealTool = requireTool || TOOL_REQUIRED_INTENTS.test(goal);
  let noToolRetryCount = 0;
  let sawToolCall = false;

  for (let step = 0; step < maxSteps; step += 1) {
    log("agent", `Helix step ${step + 1}/${maxSteps}`);

    const response = await runtime.complete({
      model: model || DEFAULT_MODEL,
      messages,
      tools,
      toolChoice: step === 0 && mustUseRealTool ? "required" : "auto",
      temperature: config.llm.temperature,
      maxTokens: maxOutputTokens ?? config.llm.maxTokens,
    });

    if (!response?.raw?.choices?.length) {
      throw new Error(`API returned no choices: ${response?.raw?.error?.message || JSON.stringify(response?.raw || {})}`);
    }

    const msg = response.message;
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.arguments) {
          try {
            JSON.parse(tc.arguments);
          } catch {
            try {
              tc.arguments = JSON.stringify(JSON.parse(jsonrepair(tc.arguments)));
            } catch {
              tc.arguments = "{}";
            }
          }
        }
      }
    }

    messages.push(msg);

    if (!msg.toolCalls || msg.toolCalls.length === 0) {
      if (!msg.content) {
        messages.pop();
        noToolRetryCount += 1;
        if (noToolRetryCount >= 2) throw new Error("Repeated empty assistant responses in Helix agent loop.");
        continue;
      }

      if (mustUseRealTool && !sawToolCall) {
        noToolRetryCount += 1;
        messages.pop();
        if (noToolRetryCount >= 2) {
          return {
            content: "I couldn't complete that reliably because no tool call was made.",
            userMessage: goal,
          };
        }
        messages.push({
          role: "system",
          content: "You have not used any tool yet. This request requires real tool execution or live tool-backed data. Call the appropriate tool first.",
        });
        continue;
      }

      return {
        content: msg.content || "",
        userMessage: goal,
        raw: response.raw,
      };
    }

    sawToolCall = true;

    for (const toolCall of msg.toolCalls) {
      const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
      log("tool", `Helix calling ${toolCall.name}`);
      const result = await executeTool(toolCall.name, args);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    content: "Reached max steps without a final answer.",
    userMessage: goal,
  };
}
