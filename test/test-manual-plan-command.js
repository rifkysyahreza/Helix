import assert from "assert";
import fs from "fs";

const INDEX_FILE = new URL("../index.js", import.meta.url);
const source = fs.readFileSync(INDEX_FILE, "utf8");

assert(source.includes('Commands: /status, /health, /audit, /drill, /burn-in start [paper|approval], /burn-in stop, /burn-in status, /burn-in runbook, /burn-in plan, /watch, /plan, /manage, /maintain'), "command help should advertise /plan");
assert(source.includes('} else if (input === "/plan") {'), "manual /plan command should exist");
assert(source.includes('const result = await runPlannerCycle();'), "manual /plan should call runPlannerCycle");

console.log("manual plan command tests passed");
