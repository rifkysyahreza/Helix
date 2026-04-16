import fs from "fs";
import path from "path";
import { getRuntimeDataFile } from "./storage-paths.js";

const CONTROLS_FILE = getRuntimeDataFile("operator-controls.json", "HELIX_OPERATOR_CONTROLS_FILE");
const DEFAULT_INTENT_TTL_MS = Number(process.env.HELIX_PENDING_INTENT_TTL_MS || 30 * 60 * 1000);

function loadControls() {
  if (!fs.existsSync(CONTROLS_FILE)) {
    return {
      halted: false,
      closeOnly: false,
      suspendedSymbols: {},
      updatedAt: null,
    };
  }

  try {
    return JSON.parse(fs.readFileSync(CONTROLS_FILE, "utf8"));
  } catch {
    return {
      halted: false,
      closeOnly: false,
      suspendedSymbols: {},
      updatedAt: null,
    };
  }
}

function saveControls(data) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONTROLS_FILE, JSON.stringify(data, null, 2));
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function getOperatorControls() {
  return loadControls();
}

export function setOperatorControls(patch = {}) {
  const current = loadControls();
  const next = {
    ...current,
    ...patch,
    suspendedSymbols: {
      ...(current.suspendedSymbols || {}),
      ...(patch.suspendedSymbols || {}),
    },
  };
  saveControls(next);
  return next;
}

export function haltTrading(reason = "operator_halt") {
  return setOperatorControls({ halted: true, haltReason: reason, haltedAt: new Date().toISOString() });
}

export function resumeTrading() {
  const current = loadControls();
  delete current.haltReason;
  delete current.haltedAt;
  current.halted = false;
  saveControls(current);
  return current;
}

export function setCloseOnly(enabled = true, reason = null) {
  const current = loadControls();
  current.closeOnly = Boolean(enabled);
  current.closeOnlyReason = enabled ? (reason || "operator_close_only") : null;
  saveControls(current);
  return current;
}

export function suspendSymbol(symbol, reason = "operator_suspend") {
  const current = loadControls();
  const normalized = normalizeSymbol(symbol);
  current.suspendedSymbols = current.suspendedSymbols || {};
  current.suspendedSymbols[normalized] = {
    active: true,
    reason,
    updatedAt: new Date().toISOString(),
  };
  saveControls(current);
  return current;
}

export function unsuspendSymbol(symbol) {
  const current = loadControls();
  const normalized = normalizeSymbol(symbol);
  if (current.suspendedSymbols) {
    delete current.suspendedSymbols[normalized];
  }
  saveControls(current);
  return current;
}

export function getSuspendedSymbol(symbol) {
  const controls = loadControls();
  return controls.suspendedSymbols?.[normalizeSymbol(symbol)] || null;
}

export function evaluateOperatorActionGate({ actionType, symbol = null }) {
  const controls = loadControls();
  const normalized = normalizeSymbol(symbol);
  const suspended = normalized ? controls.suspendedSymbols?.[normalized] : null;
  const isOpenLike = ["open_position", "place_order"].includes(actionType);

  if (controls.halted) {
    return {
      allowed: false,
      reason: controls.haltReason || "operator_halt_active",
      controls,
    };
  }

  if (suspended?.active && isOpenLike) {
    return {
      allowed: false,
      reason: `symbol_suspended:${normalized}`,
      controls,
    };
  }

  if (controls.closeOnly && isOpenLike) {
    return {
      allowed: false,
      reason: controls.closeOnlyReason || "close_only_active",
      controls,
    };
  }

  return {
    allowed: true,
    reason: null,
    controls,
  };
}

export function getPendingIntentTtlMs() {
  return DEFAULT_INTENT_TTL_MS;
}
