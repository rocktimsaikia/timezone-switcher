<img src="icons/icon128.png" width="64" height="64" alt="Timezone Switcher logo">

# Timezone Switcher

Chrome extension to override the browser's effective timezone - pick a
country, pick one of its timezones, every tab's `Date`/`Intl` reflects it
immediately.

## Install

1. `chrome://extensions` -> enable **Developer mode**.
2. **Load unpacked** -> select this folder.

## Usage

1. Click the extension icon, search a country, pick a timezone, **Apply**.
2. **Reset to system timezone** to go back to normal.

Applying attaches Chrome's debugger to open tabs, which shows a yellow
"being debugged" bar per tab - that's Chrome's own signal, not a bug, and
it stays until you reset.
