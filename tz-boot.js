// MAIN-world content script at document_start, right after tz-shim.js - runs before any page script.
// The timezone arrives as a short-lived cookie that background.js appends (via a declarativeNetRequest
// rule scoped to the overridden tab) to that tab's document responses. Read it, delete it, apply.
(() => {
  try {
    const m = document.cookie.match(/(?:^|;\s*)__tzs=([^;]+)/);
    if (m) {
      document.cookie = "__tzs=; Path=/; Max-Age=0";
      tzShim(decodeURIComponent(m[1]));
    }
  } catch {
    // sandboxed frames throw on document.cookie - they just keep the real timezone
  }
  window.tzShim = undefined;
})();
