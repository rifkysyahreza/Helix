import assert from "assert";
import fs from "fs";

const source = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
assert(source.includes('async function refreshHealthSummary(reason = "runtime_cycle")'), "refreshHealthSummary helper should exist");
assert(source.includes('await refreshHealthSummary("observer_cycle_completed")'), "observer cycle should refresh health summary");
assert(source.includes('await refreshHealthSummary("planner_cycle_completed")'), "planner cycle should refresh health summary");
assert(source.includes('await refreshHealthSummary("management_cycle_completed")'), "management cycle should refresh health summary");
assert(source.includes('await refreshHealthSummary("manual_maintain_completed")'), "manual maintain should refresh health summary");
console.log("health summary refresh hook tests passed");
