import fs from "fs";

const BURN_IN_FILE = "./runtime-data/burn-in-state.json";

function load() {
  if (!fs.existsSync(BURN_IN_FILE)) {
    return {
      enabled: false,
      mode: "paper",
      startedAt: null,
      lastUpdatedAt: null,
      cycles: 0,
      approvalsReviewed: 0,
      successfulExecutions: 0,
      blockedExecutions: 0,
      severeIncidents: 0,
      driftEvents: 0,
      iocCancelEvents: 0,
      errorEvents: 0,
      notes: [],
    };
  }
  try {
    return JSON.parse(fs.readFileSync(BURN_IN_FILE, "utf8"));
  } catch {
    return {
      enabled: false,
      mode: "paper",
      startedAt: null,
      lastUpdatedAt: null,
      cycles: 0,
      approvalsReviewed: 0,
      successfulExecutions: 0,
      blockedExecutions: 0,
      severeIncidents: 0,
      driftEvents: 0,
      iocCancelEvents: 0,
      errorEvents: 0,
      notes: [],
    };
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

export function startBurnIn({ mode = "paper", note = null } = {}) {
  const state = load();
  state.enabled = true;
  state.mode = mode;
  state.startedAt = state.startedAt || new Date().toISOString();
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

export function recordBurnInEvent(event = {}) {
  const state = load();
  state.cycles += 1;
  if (event.approvalReviewed) state.approvalsReviewed += 1;
  if (event.successfulExecution) state.successfulExecutions += 1;
  if (event.blockedExecution) state.blockedExecutions += 1;
  if (event.severeIncident) state.severeIncidents += 1;
  if (event.driftEvent) state.driftEvents += 1;
  if (event.iocCancelEvent) state.iocCancelEvents += 1;
  if (event.errorEvent) state.errorEvents += 1;
  if (event.note) state.notes.push({ at: new Date().toISOString(), note: event.note });
  save(state);
  return state;
}

export function summarizeBurnInState() {
  const state = load();
  const scoreBase = Math.max(1, state.cycles || 1);
  const reliabilityScore = Number(((state.successfulExecutions - state.blockedExecutions - state.severeIncidents - state.errorEvents - state.iocCancelEvents * 0.5) / scoreBase).toFixed(2));
  const promotionReady = state.enabled
    && state.cycles >= 5
    && state.severeIncidents === 0
    && state.driftEvents <= 1
    && state.iocCancelEvents <= 1
    && state.errorEvents === 0;

  return {
    ...state,
    reliabilityScore,
    promotionReady,
  };
}
