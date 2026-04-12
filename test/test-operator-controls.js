import assert from "assert";
import fs from "fs";
import {
  getOperatorControls,
  haltTrading,
  resumeTrading,
  setCloseOnly,
  suspendSymbol,
  unsuspendSymbol,
  evaluateOperatorActionGate,
} from "../operator-controls.js";

const CONTROLS_FILE = "./runtime-data/operator-controls.json";

function cleanup() {
  if (fs.existsSync(CONTROLS_FILE)) fs.unlinkSync(CONTROLS_FILE);
}

function run() {
  cleanup();

  const initial = getOperatorControls();
  assert.equal(initial.halted, false);
  assert.equal(initial.closeOnly, false);

  haltTrading("manual_test_halt");
  let gate = evaluateOperatorActionGate({ actionType: "place_order", symbol: "BTC" });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "manual_test_halt");

  resumeTrading();
  setCloseOnly(true, "maintenance");
  gate = evaluateOperatorActionGate({ actionType: "place_order", symbol: "BTC" });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "maintenance");

  gate = evaluateOperatorActionGate({ actionType: "close_position", symbol: "BTC" });
  assert.equal(gate.allowed, true);

  setCloseOnly(false);
  suspendSymbol("sol", "bad_conditions");
  gate = evaluateOperatorActionGate({ actionType: "place_order", symbol: "SOL" });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, "symbol_suspended:SOL");

  unsuspendSymbol("SOL");
  gate = evaluateOperatorActionGate({ actionType: "place_order", symbol: "SOL" });
  assert.equal(gate.allowed, true);

  cleanup();
  console.log("operator controls tests passed");
}

run();
