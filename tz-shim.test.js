// Run: node tz-shim.test.js
// Compares the shim (spoofing a zone while the process runs in another) against
// native Node launched with TZ=<zone> - native behavior is the ground truth.
const { execFileSync } = require("child_process");
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const REAL_TZ = "America/Los_Angeles";
if (process.env.TZ !== REAL_TZ) {
  execFileSync(process.execPath, [__filename], { stdio: "inherit", env: { ...process.env, TZ: REAL_TZ } });
  process.exit(0);
}

const EXPRS = [
  "new Date(0).getHours()",
  "new Date(0).getTimezoneOffset()",
  "new Date(0).toString()",
  "new Date(1720000000000).toString()",
  "new Date(1720000000000).toDateString()",
  "new Date(1720000000000).toTimeString()",
  "new Date(2024, 0, 15, 10, 30).getTime()",
  "new Date(2024, 6, 15, 10, 30).getTime()",
  "new Date(2024, 6, 15).getTimezoneOffset()",
  "new Date(2024, 0, 15).getTimezoneOffset()",
  "new Date(99, 0, 1).getTime()",
  "new Date(2024, 13, 40).getTime()",
  "new Date(2024, 2, 10, 2, 30).getTime()", // NY spring-forward gap
  "new Date(2024, 10, 3, 1, 30).getTime()", // NY fall-back overlap
  "new Date(2024, 9, 27, 2, 30).getTime()", // Berlin fall-back overlap
  "new Date(2024, 2, 31, 2, 30).getTime()", // Berlin spring-forward gap
  "new Date('2024-01-15T10:00').getTime()",
  "new Date('2024-01-15T10:00:00Z').getTime()",
  "new Date('2024-01-15').getTime()",
  "new Date('Jan 15 2024 10:00').getTime()",
  "new Date('Mon Jan 15 2024 10:00:00 GMT+0900 (Japan Standard Time)').getTime()",
  "Date.parse('2024-07-04T12:00')",
  "(() => { const d = new Date(1720000000000); d.setHours(0, 0, 0, 0); return d.getTime(); })()",
  "(() => { const d = new Date(1720000000000); d.setDate(1); d.setMonth(1); return d.getTime(); })()",
  "(() => { const d = new Date(1720000000000); d.setFullYear(2020); return d.getTime(); })()",
  "(() => { const d = new Date(1720000000000); d.setMinutes(90); return d.getTime(); })()",
  "[1720000000000].map(t => { const d = new Date(t); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getDay(), d.getHours(), d.getMinutes(), d.getSeconds()]; })[0].join()",
  "new Date(1720000000000).toLocaleString('en-US')",
  "new Date(1720000000000).toLocaleDateString('en-GB')",
  "new Date(1720000000000).toLocaleTimeString('en-US', { timeZone: 'UTC' })",
  "Intl.DateTimeFormat().resolvedOptions().timeZone",
  "new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(0)",
  "String(new Date(NaN))",
  "new Date(NaN).getHours()",
  "typeof Date()",
  "new Date(1720000000000) instanceof Date",
  "new Date(-62198755200000).getFullYear()", // year 0
];

const shimSrc = fs.readFileSync(__dirname + "/tz-shim.js", "utf8");
let failures = 0;

for (const zone of ["Asia/Tokyo", "America/New_York", "Europe/Berlin", "Asia/Kolkata", "Australia/Sydney", "UTC"]) {
  const native = JSON.parse(
    execFileSync(process.execPath, ["-e", `console.log(JSON.stringify(${JSON.stringify(EXPRS)}.map(e => String(eval(e)))))`], {
      env: { ...process.env, TZ: zone },
    }).toString()
  );

  const ctx = vm.createContext({});
  vm.runInContext("var window = globalThis;" + shimSrc + `\ntzShim(${JSON.stringify(zone)});`, ctx);

  EXPRS.forEach((expr, i) => {
    const got = String(vm.runInContext(expr, ctx));
    try {
      assert.strictEqual(got, native[i]);
    } catch {
      failures++;
      console.log(`FAIL [${zone}] ${expr}\n  shim:   ${got}\n  native: ${native[i]}`);
    }
  });
}

console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
