import assert from "assert";
import fs from "fs";
import { executeTool } from "../tools/executor.js";

const FILE = "./runtime-data/pending-intents.json";

function writeFixture() {
  fs.mkdirSync("./runtime-data", { recursive: true });
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
