# Timezone Switcher

Chrome extension to override the browser's effective timezone for testing -
pick a country, pick one of its IANA timezones, and every tab's `Date`/`Intl`
calls reflect it immediately.

## Install (unpacked)

1. `chrome://extensions` -> enable **Developer mode**.
2. **Load unpacked** -> select this folder.

## Usage

1. Click the extension icon.
2. Search a country, pick a timezone from the dropdown.
3. **Apply** - open tabs reload under the new timezone; new tabs and
   navigations pick it up automatically without reloading.
4. **Reset to system timezone** to go back to normal.

## How it works

Uses `chrome.debugger` + the Chrome DevTools Protocol
(`Emulation.setTimezoneOverride`) - the same mechanism as DevTools' Sensors
panel - so it's a real override, not a JS-level `Date`/`Intl` shim.

Country -> timezone data is generated from the system's IANA tzdata
(`/usr/share/zoneinfo/zone1970.tab` + `iso3166.tab`), not hand-typed.

## The yellow "being debugged" bar

Chrome shows a persistent infobar on any tab the extension attaches its
debugger to, for as long as an override is active. That's Chrome's own
anti-abuse signal for the `chrome.debugger` API - it can't be hidden or
styled, and it's the tradeoff for a real timezone override instead of a
spoof. The extension's toolbar badge (green "TZ") is the visible signal for
when an override is on; the infobar is Chrome's, not the extension's.
