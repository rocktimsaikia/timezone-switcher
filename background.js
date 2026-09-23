const CDP_VERSION = "1.3";
const ACTIVE_BADGE_TEXT = "TZ";
const ACTIVE_BADGE_COLOR = "#2e7d32";

async function getActiveTimezone() {
  const { activeTimezone } = await chrome.storage.local.get("activeTimezone");
  return activeTimezone ?? null;
}

function updateBadge(timezone) {
  chrome.action.setBadgeText({ text: timezone ? ACTIVE_BADGE_TEXT : "" });
  if (timezone) chrome.action.setBadgeBackgroundColor({ color: ACTIVE_BADGE_COLOR });
}

// ponytail: debugger.attach() throws if already attached to this tab; that's
// the expected steady-state case (re-applying on navigation), so swallow it.
async function applyToTab(tabId, timezoneId, { reload = false } = {}) {
  try {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
  } catch (e) {
    if (!String(e.message).includes("already attached")) return;
  }
  try {
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setTimezoneOverride", { timezoneId });
    // Page JS that already ran (rendered timestamps, etc.) saw the old timezone -
    // reload so it re-evaluates Date/Intl under the new one. Only on an explicit
    // user action, not on the silent re-apply that happens for every navigation.
    if (reload) chrome.tabs.reload(tabId).catch(() => {});
  } catch (e) {
    // Tab doesn't support the Emulation domain (chrome://, Web Store, etc.) - don't leave a stray debugger banner on it.
    chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

async function applyToAllTabs(timezoneId) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((t) => applyToTab(t.id, timezoneId, { reload: true })));
}

async function clearAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (t) => {
      try {
        await chrome.debugger.sendCommand({ tabId: t.id }, "Emulation.setTimezoneOverride", { timezoneId: "" });
        chrome.tabs.reload(t.id).catch(() => {});
      } catch (e) {
        /* not attached to this tab, nothing to clear */
      }
      chrome.debugger.detach({ tabId: t.id }).catch(() => {});
    })
  );
}

async function resetOverride() {
  await clearAllTabs();
  await chrome.storage.local.remove("activeTimezone");
  updateBadge(null);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "SET_TIMEZONE") {
      await chrome.storage.local.set({ activeTimezone: msg.timezone });
      await applyToAllTabs(msg.timezone);
      updateBadge(msg.timezone);
      sendResponse({ ok: true });
    } else if (msg.type === "CLEAR_TIMEZONE") {
      await resetOverride();
      sendResponse({ ok: true });
    } else if (msg.type === "GET_STATE") {
      sendResponse({ activeTimezone: await getActiveTimezone() });
    }
  })();
  return true;
});

// Re-apply on every new tab and every navigation, since a CDP timezone
// override does not automatically carry over to a fresh navigation/tab.
chrome.tabs.onCreated.addListener(async (tab) => {
  const tz = await getActiveTimezone();
  if (tz && tab.id !== undefined) applyToTab(tab.id, tz);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  const tz = await getActiveTimezone();
  if (tz) applyToTab(tabId, tz);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.debugger.detach({ tabId }).catch(() => {});
});

// User clicked "Cancel" on Chrome's "started debugging this browser" infobar -
// they're rejecting the debugger session, so treat it the same as hitting Reset.
chrome.debugger.onDetach.addListener(async (_source, reason) => {
  if (reason !== "canceled_by_user") return;
  if (await getActiveTimezone()) await resetOverride();
});

chrome.runtime.onStartup.addListener(async () => {
  const tz = await getActiveTimezone();
  if (tz) {
    await applyToAllTabs(tz);
    updateBadge(tz);
  }
});
