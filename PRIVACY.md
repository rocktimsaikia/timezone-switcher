# Privacy Policy

Timezone Switcher does not collect, store, or transmit any personal data.

- No analytics, tracking, or telemetry of any kind.
- No network requests are made by the extension - the country/timezone data
  is bundled locally (`data/tz-data.json`).
- The only data stored is your chosen timezone and which tab it applies to,
  kept in `chrome.storage.session` on your own device. It is never sent
  anywhere and is cleared when the browser closes.
- Site access is used solely to run a small script in the tab you choose,
  before the page's own scripts, that changes what `Date`/`Intl` report in
  that page. It does not read, log, or transmit page content.
- To hand the chosen timezone to that script in time, the extension adds a
  short-lived `__tzs` cookie to that one tab's page loads. The script deletes
  it immediately; it expires on its own after 30 seconds regardless.

Uninstalling the extension removes all locally stored data.
