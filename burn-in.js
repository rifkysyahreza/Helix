import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { getRuntimeDataFile } from "./storage-paths.js";

const BURN_IN_FILE = getRuntimeDataFile("burn-in-state.json", "HELIX_BURN_IN_FILE");

function defaultState() {
  return {
    enabled: false,
    mode: "paper",
    stage: "paper",
    startedAt: null,
    lastUpdatedAt: null,
    cycles: 0,
    paperCycles: 0,
    approvalCycles: 0,
    tinyAutonomousCycles: 0,
    approvalsReviewed: 0,
    successfulExecutions: 0,
    blockedExecutions: 0,
    severeIncidents: 0,
    driftEvents: 0,
    iocCancelEvents: 0,
    errorEvents: 0,
    streamFailures: 0,
    notes: [],
  };
}

function getCurrentMode() {
  return config.execution.mode || "paper";
}

function classifyNoteMode(note = "") {
  const text = String(note || "").toLowerCase();
  if (text.includes("approval")) return "approval";
  if (text.includes("autonomous")) return "autonomous";
  if (text.includes("paper")) return "paper";
  return null;
}

function noteMatchesMode(noteEntry, mode) {
  const noteMode = classifyNoteMode(noteEntry?.note);
  if (!noteMode) return true;
  if (mode === "autonomous") return noteMode === "autonomous";
  return noteMode === mode;
}

function finalizeSummary(summary) {
  const scoreBase = Math.max(1, summary.cycles || 1);
  const reliabilityScore = Number(((summary.successfulExecutions - summary.blockedExecutions - summary.severeIncidents - summary.errorEvents - summary.iocCancelEvents * 0.5 - summary.streamFailures) / scoreBase).toFixed(2));
  const promotionReady = summary.enabled
    && summary.cycles >= 5
    && summary.severeIncidents === 0
    && summary.driftEvents <= 1
    && summary.iocCancelEvents <= 1
    && summary.errorEvents === 0
    && summary.streamFailures === 0;

  return {
    ...summary,
    reliabilityScore,
    promotionReady,
  };
}

function summarizeForMode(state, mode = getCurrentMode()) {
  const notes = Array.isArray(state.notes) ? state.notes.filter((entry) => noteMatchesMode(entry, mode)) : [];
  const summary = {
    ...state,
    currentMode: mode,
    notes,
  };

  if (mode === "paper") {
    summary.cycles = state.paperCycles;
    summary.approvalsReviewed = 0;
  } else if (mode === "approval") {
    summary.cycles = state.approvalCycles;
  } else if (mode === "autonomous") {
    summary.cycles = state.tinyAutonomousCycles;
    summary.approvalsReviewed = 0;
  }

  return finalizeSummary(summary);
}

function load() {
  if (!fs.existsSync(BURN_IN_FILE)) {
    return defaultState();
  }
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(BURN_IN_FILE, "utf8")) };
  } catch {
    return defaultState();
  }
}

function save(state) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  state.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(BURN_IN_FILE, JSON.stringify(state, null, 2));
}

export function getBurnInState() {
  return load();
}

export function startBurnIn({ mode = "paper", stage = null, note = null, resetStartedAt = false } = {}) {
  const state = load();
  state.enabled = true;
  state.mode = mode;
  state.stage = stage || mode;
  state.startedAt = resetStartedAt ? new Date().toISOString() : (state.startedAt || new Date().toISOString());
  if (note) state.notes.push({ at: new Date().toISOString(), note });
  save(state);
  return state;
}

export function stopBurnIn({ note = null } = {}) {
  const state = load();
  state.enabled = false;
  if (note) state.notes.push({ at: new Date().toISOString(), note });
  save(state);
  return state;
}

export function syncBurnInMode({ mode = "paper", stage = null, note = null } = {}) {
  const state = load();
  const nextStage = stage || mode;
  const changed = state.mode !== mode || state.stage !== nextStage || state.enabled === false;
  if (!changed) return state;

  state.enabled = true;
  state.mode = mode;
  state.stage = nextStage;
  state.startedAt = state.startedAt || new Date().toISOString();
  if (note) state.notes.push({ at: new Date().toISOString(), note });
  save(state);
  return state;
}

export function recordBurnInEvent(event = {}) {
  const state = load();
  state.cycles += 1;
  if (event.paperCycle) state.paperCycles += 1;
  if (event.approvalCycle) state.approvalCycles += 1;
  if (event.tinyAutonomousCycle) state.tinyAutonomousCycles += 1;
  if (event.approvalReviewed) state.approvalsReviewed += 1;
  if (event.successfulExecution) state.successfulExecutions += 1;
  if (event.blockedExecution) state.blockedExecutions += 1;
  if (event.severeIncident) state.severeIncidents += 1;
  if (event.driftEvent) state.driftEvents += 1;
  if (event.iocCancelEvent) state.iocCancelEvents += 1;
  if (event.errorEvent) state.errorEvents += 1;
  if (event.streamFailure) state.streamFailures += 1;
  if (event.note) state.notes.push({ at: new Date().toISOString(), note: event.note });
  save(state);
  return state;
}

export function summarizeBurnInState() {
  const state = load();
  return finalizeSummary(state);
}

export function summarizeBurnInStateForMode(mode = getCurrentMode()) {
  const state = load();
  return summarizeForMode(state, mode);
}
