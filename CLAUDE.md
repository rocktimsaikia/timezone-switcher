# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Manifest V3 Chrome extension. Plain HTML/CSS/JS, no build step, no bundler,
no package.json. Load it via `chrome://extensions` -> Developer mode ->
Load unpacked -> this folder. Reload there after any edit.

There is no lint/test/build command - verify changes by reloading the
unpacked extension and exercising the popup + a real tab (see README.md
usage steps).

## Architecture

- `background.js` - MV3 service worker, holds all state and does the actual
  timezone override work. `popup.js` never touches `chrome.debugger`
  directly; it only sends messages (`SET_TIMEZONE`, `CLEAR_TIMEZONE`,
  `GET_STATE`) that `background.js` handles.
- `popup.html` / `popup.js` / `popup.css` - country search combobox
  (hand-rolled div-based dropdown, not `<datalist>` - datalist renders as an
  unstylable native OS popup) + timezone `<select>` + apply/reset.
- `data/tz-data.json` - `{ISO country code: {name, zones: [IANA tz ids]}}`,
  generated from the system's real IANA tzdata (`/usr/share/zoneinfo/
  zone1970.tab` + `iso3166.tab`), not hand-typed. Regenerate it if it ever
  needs updating rather than editing entries by hand - see the generation
  script logic: parse `iso3166.tab` for code->name, parse `zone1970.tab` for
  code(s)->zone, group and sort by country name.

### The override mechanism

Uses `chrome.debugger` attached per-tab + CDP
`Emulation.setTimezoneOverride` (the same call DevTools' Sensors panel
uses) - a real override of `Date`/`Intl` for that tab's JS, not a
monkeypatch/shim. Tradeoff: Chrome shows a persistent "started debugging
this browser" infobar on every tab it's attached to, for as long as the
override is active. That bar is Chrome's own UI and cannot be hidden or
restyled from extension code.

Key behaviors in `background.js` worth knowing before changing it:
- **Scope is global, not per-tab.** `chrome.tabs.onCreated` and
  `chrome.tabs.onUpdated` (status `"loading"`) silently re-apply the active
  timezone to every new tab and every navigation, since a CDP override does
  not carry over across navigations on its own.
- **Reload only on explicit user action.** `applyToTab(tabId, tz, {reload})`
  takes a `reload` flag: `true` when called from the Apply/Reset button
  path (so already-rendered `Date`/`Intl` output updates immediately),
  `false` for the silent per-navigation re-apply (avoids a reload loop).
- **Cancel = Reset.** `chrome.debugger.onDetach` with reason
  `"canceled_by_user"` (user clicked Cancel on the infobar) triggers the
  same `resetOverride()` path as clicking Reset in the popup - full detach
  from all tabs, clear `chrome.storage.local`, clear the badge.
- **State lives in `chrome.storage.local`** (`activeTimezone`), not in the
  service worker's memory, since MV3 workers are ephemeral.
  `chrome.runtime.onStartup` re-applies it on browser restart.
- **Badge is the "is it on" signal**: green "TZ" badge via
  `chrome.action.setBadgeText`/`setBadgeBackgroundColor` when an override is
  active, cleared when not. The per-tab yellow infobar is a separate,
  Chrome-owned signal - don't conflate the two when reasoning about state.
