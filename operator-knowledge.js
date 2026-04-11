import fs from "fs";

const DEFAULT_PATH = process.env.HELIX_OPERATOR_KNOWLEDGE_FILE || "./operator-knowledge.json";

export function loadOperatorKnowledge() {
  if (!fs.existsSync(DEFAULT_PATH)) {
    return { path: DEFAULT_PATH, notes: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DEFAULT_PATH, "utf8"));
    return {
      path: DEFAULT_PATH,
      notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
      version: parsed?.version || 1,
    };
  } catch (error) {
    return {
      path: DEFAULT_PATH,
      notes: [],
      error: error.message,
    };
  }
}

export function summarizeOperatorKnowledge(limit = 5) {
  const knowledge = loadOperatorKnowledge();
  return knowledge.notes.slice(0, limit).map((note) => ({
    title: note.title,
    body: note.body,
    tags: note.tags || [],
  }));
}
