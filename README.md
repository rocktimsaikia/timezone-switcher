<img src="icons/icon128.png" width="64" height="64" alt="Timezone Switcher logo">

# Timezone Switcher

Chrome extension to override the browser's effective timezone - pick a
country, pick one of its timezones, every tab's `Date`/`Intl` reflects it
immediately.

## Install

[link-chrome]: https://chromewebstore.google.com/detail/timezone-switcher/jfhlfigbpompllkhhknaekjadehgajdm 'Version published on Chrome Web Store'

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="48" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/jfhlfigbpompllkhhknaekjadehgajdm.svg?label=%20">][link-chrome] [Install for Chrome][link-chrome]

## Usage

1. Click the extension icon, search a country, pick a timezone, **Apply**.
2. **Reset to system timezone** to go back to normal.

Applying attaches Chrome's debugger to open tabs, which shows a yellow
"being debugged" bar per tab - that's Chrome's own signal, not a bug, and
it stays until you reset.

## Screenshots

<p>
  <img src="store-assets/screenshot-1-idle.png" width="400" alt="Popup, idle state">
  <img src="store-assets/screenshot-2-search.png" width="400" alt="Searching a country">
</p>
<p>
  <img src="store-assets/screenshot-3-timezones.png" width="400" alt="Picking a timezone">
  <img src="store-assets/screenshot-4-apply.png" width="400" alt="Applied timezone override">
</p>
