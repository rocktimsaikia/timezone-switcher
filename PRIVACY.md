# Privacy Policy

Timezone Switcher does not collect, store, or transmit any personal data.

- No analytics, tracking, or telemetry of any kind.
- No network requests are made by the extension - the country/timezone data
  is bundled locally (`data/tz-data.json`).
- The only data stored is your chosen timezone and which tab it applies to,
  saved locally via `chrome.storage.local` on your own device. It is never
  sent anywhere and is only used to reapply your chosen override across
  navigations of that one tab and browser restarts.
- `chrome.debugger` is used solely to call the Chrome DevTools Protocol's
  `Emulation.setTimezoneOverride` on the one tab you choose, to change what
  `Date`/`Intl` report in that tab's page JavaScript. It does not read, log,
  or transmit page content.

Uninstalling the extension removes all locally stored data.
