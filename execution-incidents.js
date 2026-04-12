import fs from "fs";

const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

export function recordExecutionIncident(incident) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    ...incident,
  };
  fs.appendFileSync(INCIDENTS_FILE, JSON.stringify(entry) + "\n");
  return entry;
}

export function listExecutionIncidents(limit = 100) {
  if (!fs.existsSync(INCIDENTS_FILE)) return [];
  const raw = fs.readFileSync(INCIDENTS_FILE, "utf8").trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { malformed: true, raw: line };
      }
    });
}

export function summarizeExecutionIncidents(limit = 200) {
  const incidents = listExecutionIncidents(limit);
  const counts = incidents.reduce((acc, item) => {
    const key = item.kind || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: incidents.length,
    counts,
    latest: incidents.slice(-10),
  };
}
