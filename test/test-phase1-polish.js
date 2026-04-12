import assert from "assert";
import fs from "fs";

function run() {
  const gitignore = fs.readFileSync("./.gitignore", "utf8");
  const indexSource = fs.readFileSync("./index.js", "utf8");

  assert(gitignore.includes("runtime-data/"));
  assert(indexSource.includes('"/health"'));
  assert(indexSource.includes('"/halt"'));
  assert(indexSource.includes('"/resume"'));
  assert(indexSource.includes('"/close-only on"'));
  assert(indexSource.includes('"/suspend "'));
  assert(indexSource.includes('"/unsuspend "'));

  console.log("phase1 polish tests passed");
}

run();
