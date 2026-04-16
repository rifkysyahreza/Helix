import fs from "fs";
import { config } from "./config.js";

const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function getCurrentMode() {
  return config.execution.mode || "paper";
}

function classifyIncidentMode(item = {}) {
  const mode = item?.context?.mode || item?.mode || null;
  if (mode === "live") return "autonomous";
  return mode;
}

function shouldIncludeIncidentForMode(item, mode) {
  const incidentMode = classifyIncidentMode(item);
  if (!incidentMode) {
    if (mode === "paper") {
      return [
        "runtime_dirty_restart_detected",
        "startup_recovery_run",
        "reconciliation_repair_marked_closed",
      ].includes(item?.kind);
    }
    return false;
  }
  return incidentMode === mode;
}

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

export function summarizeExecutionIncidents(limit = 200, { mode = null } = {}) {
  const currentMode = mode || getCurrentMode();
  const incidents = listExecutionIncidents(limit);
  const filtered = incidents.filter((item) => shouldIncludeIncidentForMode(item, currentMode));
  const counts = filtered.reduce((acc, item) => {
    const key = item.kind || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: filtered.length,
    counts,
    latest: filtered.slice(-10),
    currentMode,
    allTimeTotal: incidents.length,
  };
}
