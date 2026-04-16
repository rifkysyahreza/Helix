import assert from "assert";

function buildOffsetCron(intervalMin, offset = 0) {
  if (!Number.isFinite(intervalMin) || intervalMin <= 1) return "* * * * *";
  const minutes = [];
  for (let minute = offset; minute < 60; minute += intervalMin) {
    minutes.push(minute);
  }
  return `${minutes.join(",")} * * * *`;
}

function run() {
  assert.equal(buildOffsetCron(5, 1), "1,6,11,16,21,26,31,36,41,46,51,56 * * * *");
  assert.equal(buildOffsetCron(15, 2), "2,17,32,47 * * * *");
  assert.equal(buildOffsetCron(1, 0), "* * * * *");
  console.log("management schedule offset tests passed");
}

run();
