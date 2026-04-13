import assert from "assert";
import { buildPerpBaseKnowledge, summarizePerpBaseKnowledge } from "../base-knowledge.js";

function run() {
  const knowledge = buildPerpBaseKnowledge();
  assert.ok(knowledge.marketStructure);
  assert.ok(Array.isArray(knowledge.volumeProfile.concepts));
  assert.ok(Array.isArray(knowledge.synthesisRules));

  const summary = summarizePerpBaseKnowledge();
  assert(summary.includes("Perp analysis framework:"));
  assert(summary.includes("volumeProfile"));
  assert(summary.includes("Synthesis:"));

  console.log("base knowledge tests passed");
}

run();
