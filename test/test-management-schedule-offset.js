import assert from "assert";

function buildManagementCron(intervalMin) {
  if (!Number.isFinite(intervalMin) || intervalMin <= 1) return "* * * * *";
  const minutes = [];
  for (let minute = 1; minute < 60; minute += intervalMin) {
    minutes.push(minute);
  }
  return `${minutes.join(",")} * * * *`;
}

function run() {
  assert.equal(buildManagementCron(5), "1,6,11,16,21,26,31,36,41,46,51,56 * * * *");
  assert.equal(buildManagementCron(15), "1,16,31,46 * * * *");
  assert.equal(buildManagementCron(1), "* * * * *");
  console.log("management schedule offset tests passed");
}

run();
