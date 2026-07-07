import { parseDuration, formatDuration } from "../lib/stat-fields";
const cases: [string, number][] = [["31:24", 1884], ["5:07", 307], ["0:00", 0], ["30:00", 1800]];
let ok = true;
for (const [str, sec] of cases) {
  const p = parseDuration(str);
  const f = formatDuration(sec);
  const roundtrip = formatDuration(p);
  if (p !== sec || f !== str || roundtrip !== str) { ok = false; console.log("FAIL", str, {p, f, roundtrip}); }
  else console.log(`OK  "${str}" <-> ${sec}s`);
}
console.log(`formatDuration(3900) = ${formatDuration(3900)} (season total, minutes>59)`);
try { parseDuration("31:75"); console.log("FAIL: should reject 31:75"); ok=false; } catch { console.log('OK  rejects "31:75" (sec>59)'); }
console.log(ok ? "PASS" : "FAIL");
