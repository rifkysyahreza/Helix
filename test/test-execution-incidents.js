import assert from "assert";
import fs from "fs";
import { recordExecutionIncident, listExecutionIncidents, summarizeExecutionIncidents } from "../execution-incidents.js";

const INCIDENTS_FILE = "./runtime-data/execution-incidents.jsonl";

function cleanup() {
  if (fs.existsSync(INCIDENTS_FILE)) fs.unlinkSync(INCIDENTS_FILE);
}

function run() {
  cleanup();

  recordExecutionIncident({ kind: "open_risk_block", symbol: "BTC" });
  recordExecutionIncident({ kind: "open_risk_block", symbol: "ETH" });
  recordExecutionIncident({ kind: "reconciliation_repair_marked_closed", symbol: "SOL" });

  const items = listExecutionIncidents(10);
  assert.equal(items.length, 3);
  assert.equal(items[0].kind, "open_risk_block");

  const summary = summarizeExecutionIncidents(10);
  assert.equal(summary.total, 3);
  assert.equal(summary.counts.open_risk_block, 2);
  assert.equal(summary.counts.reconciliation_repair_marked_closed, 1);

  cleanup();
  console.log("execution incident tests passed");
}

run();
