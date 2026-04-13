import assert from "assert";
import fs from "fs";

const source = fs.readFileSync(new URL("../execution.js", import.meta.url), "utf8");

function run() {
  assert(source.includes('style === "resting_limit_preferred"'));
  assert(source.includes('style === "small_probe_limit"'));
  assert(source.includes('style === "stand_aside"'));
  assert(source.includes('tif: "Gtc"'));
  assert(source.includes('kind: "open_policy_block"'));
  console.log("execution open policy tests passed");
}

run();
