# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Manifest V3 Chrome extension. Plain HTML/CSS/JS, no build step, no bundler,
no package.json. Load it via `chrome://extensions` -> Developer mode ->
Load unpacked -> this folder. Reload there after any edit.

`node tz-shim.test.js` checks the Date/Intl shim against native Node run with
`TZ=<zone>` (ground truth) across several zones, including DST gaps/overlaps.
Run it after touching `tz-shim.js`. Everything else is verified by reloading
the unpacked extension and exercising the popup + a real tab.

Store upload zip lists files explicitly (keep `tz-shim.js`/`tz-boot.js` in it,
keep the test out):
`zip -r timezone-switcher.zip manifest.json background.js tz-shim.js tz-boot.js popup.html popup.js popup.css data icons`

## Architecture

- `background.js` - MV3 service worker, holds all state and wires up the
  override. `popup.js` only sends messages (`SET_TIMEZONE`, `CLEAR_TIMEZONE`,
  `GET_STATE`) that `background.js` handles.
- `tz-shim.js` - `tzShim(tz)`: replaces `Date` (constructor, `parse`, local
  getters/setters, `getTimezoneOffset`, `toString` family, `toLocale*`) and
  `Intl.DateTimeFormat` (default `timeZone`) so page JS sees `tz`.
- `tz-boot.js` - content script that reads the timezone from the `__tzs`
  cookie and calls `tzShim`.
- `popup.html` / `popup.js` / `popup.css` - country search combobox
  (hand-rolled div-based dropdown, not `<datalist>` - datalist renders as an
  unstylable native OS popup) + timezone `<select>` + apply/reset.
- `data/tz-data.json` - `{ISO country code: {name, zones: [IANA tz ids]}}`,
  generated from the system's real IANA tzdata (`/usr/share/zoneinfo/
  zone1970.tab` + `iso3166.tab`), not hand-typed. Regenerate it if it ever
  needs updating rather than editing entries by hand - parse `iso3166.tab`
  for code->name, parse `zone1970.tab` for code(s)->zone, group and sort by
  country name.

### The override mechanism

A JS-level shim, not a real browser timezone change (the only real one is
`chrome.debugger` + CDP `Emulation.setTimezoneOverride`, which was dropped
because Chrome shows a permanent "being debugged" infobar for it). Known
limits: Web Workers are never patched, and fingerprinting code can detect the
patched functions.

The hard part is timing: the shim must run before any page script.
`tz-shim.js` + `tz-boot.js` are registered
(`chrome.scripting.registerContentScripts`, MAIN world, `document_start`, all
frames) for every site, and do nothing unless a `__tzs` cookie is present.
`setCookieRules` adds `declarativeNetRequest` session rules scoped by `tabIds`
to the overridden tab that append `Set-Cookie: __tzs=<tz>` to its
main_frame/sub_frame responses. The cookie exists before the document parses,
so `tz-boot.js` reads it synchronously, deletes it (so other tabs on the same
site never see it), and applies the shim ahead of even inline `<head>`
scripts. A content script can't get the timezone synchronously any other way -
`chrome.storage` is async, and `registerContentScripts` takes files, not
arguments. Injecting via `executeScript` at navigation commit was tried and
loses the race to inline `<head>` scripts.

Consequence: documents the cookie can't reach keep the real timezone -
file:// pages (no HTTP response) and frames with third-party cookies
blocked.

Key behaviors worth knowing before changing it:
- **Scope is a single tab.** `popup.js` passes the active tab's id with
  `SET_TIMEZONE`. Applying from another tab moves the override (old tab's
  badge cleared and reloaded). Nothing follows onto other or new tabs.
- **Apply/Reset reload the tab** - the shim only takes effect on a fresh
  document, and a reload is the only way to get one.
- **Site access is optional.** `<all_urls>` is in
  `optional_host_permissions`, requested on the first Apply (no install-time
  warning). The prompt can close the popup before it sends `SET_TIMEZONE`, so
  the popup stashes `pendingApply` in `chrome.storage.session` and
  `permissions.onAdded` in the background finishes it (ignored if older than
  60s). `webNavigation` was deliberately dropped to avoid the "Read your
  browsing history" prompt line.
- **State lives in `chrome.storage.session`** (`activeTimezone`,
  `activeTabId`). Session storage clears on browser restart, which is right
  since tab ids don't survive a restart. DNR session rules clear with it.
- **Badge is per-tab** (`{tabId}` on `setBadgeText`), re-set on each
  `tabs.onUpdated` `"loading"` for the overridden tab.
- **Popup opened on a different tab** than the overridden one shows
  "(on another tab)" in the status line and leaves the country/timezone
  pickers empty - they only prefill on the overridden tab itself.
