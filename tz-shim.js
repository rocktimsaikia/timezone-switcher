// Runs in the page's MAIN world as a content script; tz-boot.js calls tzShim with the timezone.
function tzShim(tz) {
  if (window.__tzSwitcherApplied) return;
  Object.defineProperty(window, "__tzSwitcherApplied", { value: true });

  const OrigDate = Date;
  const OrigDTF = Intl.DateTimeFormat;
  const proto = OrigDate.prototype;
  const DAY = 86400000;

  const real = {};
  for (const n of ["getFullYear", "getMonth", "getDate", "getHours", "getMinutes", "getSeconds", "getMilliseconds"]) {
    real[n] = proto[n];
  }

  const partsFmt = new OrigDTF("en-US", {
    timeZone: tz, hourCycle: "h23", era: "short", weekday: "short",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  });
  const nameFmt = new OrigDTF("en-US", { timeZone: tz, timeZoneName: "long" });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let lastT, lastQ;
  function parts(t) {
    if (t === lastT) return lastQ;
    const p = {};
    for (const { type, value } of partsFmt.formatToParts(t)) p[type] = value;
    let y = +p.year;
    if (p.era === "BC") y = 1 - y;
    lastT = t;
    lastQ = { y, mo: +p.month - 1, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, ms: ((t % 1000) + 1000) % 1000, wd: WD[p.weekday] };
    return lastQ;
  }

  // setUTC* instead of Date.UTC, which remaps years 0-99 to 1900-1999
  function utcOf(y, mo, d, h, mi, s, ms) {
    const x = new OrigDate(0);
    x.setUTCFullYear(y, mo, d);
    x.setUTCHours(h, mi, s, ms);
    return x.getTime();
  }

  // Same sign convention as Date#getTimezoneOffset: minutes to ADD to local to get UTC.
  function offsetMin(t) {
    const q = parts(t);
    return (t - utcOf(q.y, q.mo, q.d, q.h, q.mi, q.s, q.ms)) / 60000;
  }

  // Wall-clock time in `tz` -> UTC ms, matching the spec for DST edges:
  // ambiguous (fall back) picks the earlier instant, skipped (spring forward) uses the pre-transition offset.
  function wallToUtc(y, mo, d, h, mi, s, ms) {
    const guess = utcOf(y, mo, d, h, mi, s, ms);
    if (isNaN(guess)) return NaN;
    const cands = [offsetMin(guess - DAY), offsetMin(guess), offsetMin(guess + DAY)];
    const valid = cands.filter((o) => offsetMin(guess + o * 60000) === o);
    const o = valid.length ? Math.min(...valid) : Math.max(...cands);
    return guess + o * 60000;
  }

  const ZONE_RE = /(Z|[+-]\d{2}:?\d{2}|\b(GMT|UTC|UT)([+-]\d+)?|\b[ECMP][SD]T)\s*(\([^)]*\))?$/i;
  const DATE_ONLY_ISO = /^[+-]?\d{4,6}(-\d{2}(-\d{2})?)?$/;

  // ponytail: heuristic zone detection - a string with no explicit zone was parsed as the
  // REAL local wall time, so reinterpret it in the spoofed zone. Exotic formats may slip through.
  function parseLocal(str) {
    const t = OrigDate.parse(str);
    const s = str.trim();
    if (isNaN(t) || DATE_ONLY_ISO.test(s) || ZONE_RE.test(s)) return t;
    const d = new OrigDate(t);
    return wallToUtc(...Object.values(real).map((fn) => fn.call(d)));
  }

  const getters = { getFullYear: "y", getMonth: "mo", getDate: "d", getDay: "wd", getHours: "h", getMinutes: "mi", getSeconds: "s", getMilliseconds: "ms" };
  for (const [name, key] of Object.entries(getters)) {
    proto[name] = function () {
      const t = this.getTime();
      return isNaN(t) ? NaN : parts(t)[key];
    };
  }
  proto.getYear = function () { return this.getFullYear() - 1900; };
  proto.getTimezoneOffset = function () {
    const t = this.getTime();
    return isNaN(t) ? NaN : offsetMin(t);
  };

  const setters = {
    setMilliseconds: ["ms"], setSeconds: ["s", "ms"], setMinutes: ["mi", "s", "ms"], setHours: ["h", "mi", "s", "ms"],
    setDate: ["d"], setMonth: ["mo", "d"], setFullYear: ["y", "mo", "d"],
  };
  for (const [name, keys] of Object.entries(setters)) {
    proto[name] = function (...args) {
      const t = this.getTime();
      if (isNaN(t) && name !== "setFullYear") return NaN;
      const q = isNaN(t) ? { y: 1970, mo: 0, d: 1, h: 0, mi: 0, s: 0, ms: 0 } : { ...parts(t) };
      keys.forEach((k, i) => { if (i < args.length) q[k] = Number(args[i]); });
      if (args.length === 0) q[keys[0]] = NaN;
      return this.setTime(wallToUtc(q.y, q.mo, q.d, q.h, q.mi, q.s, q.ms));
    };
  }

  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const yearStr = (y) => (y < 0 ? "-" + pad(-y, 6) : pad(y, 4));
  function zoneStr(t) {
    const east = -offsetMin(t);
    const a = Math.abs(east);
    const name = nameFmt.formatToParts(t).find((p) => p.type === "timeZoneName")?.value ?? tz;
    return `GMT${east >= 0 ? "+" : "-"}${pad(Math.floor(a / 60))}${pad(Math.floor(a % 60))} (${name})`;
  }
  const dateStr = (q) => `${DAYS[q.wd]} ${MONTHS[q.mo]} ${pad(q.d)} ${yearStr(q.y)}`;
  const timeStr = (q, t) => `${pad(q.h)}:${pad(q.mi)}:${pad(q.s)} ${zoneStr(t)}`;

  proto.toString = function () {
    const t = this.getTime();
    if (isNaN(t)) return "Invalid Date";
    const q = parts(t);
    return `${dateStr(q)} ${timeStr(q, t)}`;
  };
  proto.toDateString = function () {
    const t = this.getTime();
    return isNaN(t) ? "Invalid Date" : dateStr(parts(t));
  };
  proto.toTimeString = function () {
    const t = this.getTime();
    return isNaN(t) ? "Invalid Date" : timeStr(parts(t), t);
  };

  const withTz = (options) => {
    const o = options === undefined ? {} : Object(options);
    return o.timeZone === undefined ? { ...o, timeZone: tz } : o;
  };
  for (const name of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    const orig = proto[name];
    proto[name] = function (locales, options) { return orig.call(this, locales, withTz(options)); };
  }

  function FakeDTF(locales, options) {
    return new.target
      ? Reflect.construct(OrigDTF, [locales, withTz(options)], new.target)
      : OrigDTF(locales, withTz(options));
  }
  FakeDTF.prototype = OrigDTF.prototype;
  FakeDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf;
  Intl.DateTimeFormat = FakeDTF;

  function FakeDate(...args) {
    if (!new.target) return new FakeDate().toString();
    let a = args;
    if (args.length === 1 && typeof args[0] === "string") {
      a = [parseLocal(args[0])];
    } else if (args.length >= 2) {
      let [y, mo, d = 1, h = 0, mi = 0, s = 0, ms = 0] = args.map(Number);
      const yi = Math.trunc(y);
      if (yi >= 0 && yi <= 99) y = 1900 + yi;
      a = [wallToUtc(y, mo, d, h, mi, s, ms)];
    }
    return Reflect.construct(OrigDate, a, new.target);
  }
  Object.defineProperty(FakeDate, "length", { value: 7 });
  FakeDate.prototype = proto;
  FakeDate.now = OrigDate.now;
  FakeDate.UTC = OrigDate.UTC;
  FakeDate.parse = (s) => parseLocal(String(s));
  proto.constructor = FakeDate;
  window.Date = FakeDate;
}
