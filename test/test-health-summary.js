import assert from "assert";
import { buildHealthSummary } from "../health-summary.js";

async function run() {
  const report = await buildHealthSummary({ limit: 20 });
  assert(report.generatedAt);
  assert(report.controls);
  assert(report.trades);
  assert(report.pendingIntents);
  assert(Array.isArray(report.summaryLines));
  console.log("health summary tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
