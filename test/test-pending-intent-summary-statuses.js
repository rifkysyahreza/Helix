import assert from "assert";
import fs from "fs";
import { setupIsolatedTestEnv } from "./test-env.js";

setupIsolatedTestEnv("helix-pending-summary-");
const { executeTool } = await import("../tools/executor.js");

const FILE = process.env.HELIX_PENDING_INTENTS_FILE;

function writeFixture() {
  fs.mkdirSync(process.env.HELIX_RUNTIME_DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({
    intents: [
      { id: "1", status: "pending" },
      { id: "2", status: "approved" },
      { id: "3", status: "rejected" },
      { id: "4", status: "approval_failed" },
      { id: "5", status: "expired" }
    ]
  }, null, 2));
}

async function run() {
  writeFixture();
  const result = await executeTool("list_pending_intents", {});
  assert.equal(result.summary.pending, 1);
  assert.equal(result.summary.approved, 1);
  assert.equal(result.summary.rejected, 1);
  assert.equal(result.summary.approvalFailed, 1);
  assert.equal(result.summary.expired, 1);
  console.log("pending intent summary status tests passed");
}

run();
