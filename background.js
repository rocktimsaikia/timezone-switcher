const CDP_VERSION = "1.3";
const ACTIVE_BADGE_TEXT = "TZ";
const ACTIVE_BADGE_COLOR = "#3d8743";

async function getState() {
  const { activeTimezone, activeTabId } = await chrome.storage.local.get(["activeTimezone", "activeTabId"]);
  return { activeTimezone: activeTimezone ?? null, activeTabId: activeTabId ?? null };
}

function updateBadge(tabId, timezone) {
  chrome.action.setBadgeText({ tabId, text: timezone ? ACTIVE_BADGE_TEXT : "" });
  if (timezone) chrome.action.setBadgeBackgroundColor({ tabId, color: ACTIVE_BADGE_COLOR });
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

async function clearTab(tabId) {
  try {
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setTimezoneOverride", { timezoneId: "" });
    chrome.tabs.reload(tabId).catch(() => {});
  } catch (e) {
    /* not attached to this tab, nothing to clear */
  }
  chrome.debugger.detach({ tabId }).catch(() => {});
  updateBadge(tabId, null);
}

async function resetOverride() {
  const { activeTabId } = await getState();
  if (activeTabId !== null) await clearTab(activeTabId);
  await chrome.storage.local.remove(["activeTimezone", "activeTabId"]);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "SET_TIMEZONE") {
      const { activeTabId: prevTabId } = await getState();
      if (prevTabId !== null && prevTabId !== msg.tabId) await clearTab(prevTabId);
      await chrome.storage.local.set({ activeTimezone: msg.timezone, activeTabId: msg.tabId });
      await applyToTab(msg.tabId, msg.timezone, { reload: true });
      updateBadge(msg.tabId, msg.timezone);
      sendResponse({ ok: true });
    } else if (msg.type === "CLEAR_TIMEZONE") {
      await resetOverride();
      sendResponse({ ok: true });
    } else if (msg.type === "GET_STATE") {
      sendResponse(await getState());
    }
  })();
  return true;
});

// Re-apply on navigation of the SAME tab only - a CDP override does not
// survive a navigation on its own, but this extension no longer follows the
// override onto other tabs.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  const { activeTimezone, activeTabId } = await getState();
  if (activeTimezone && tabId === activeTabId) applyToTab(tabId, activeTimezone);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  chrome.debugger.detach({ tabId }).catch(() => {});
  const { activeTabId } = await getState();
  if (tabId === activeTabId) await chrome.storage.local.remove(["activeTimezone", "activeTabId"]);
});

// User clicked "Cancel" on Chrome's "started debugging this browser" infobar -
// they're rejecting the debugger session, so treat it the same as hitting Reset.
chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (reason !== "canceled_by_user") return;
  const { activeTabId } = await getState();
  if (source.tabId === activeTabId) await resetOverride();
});

chrome.runtime.onStartup.addListener(async () => {
  const { activeTimezone, activeTabId } = await getState();
  if (!activeTimezone || activeTabId === null) return;
  try {
    await chrome.tabs.get(activeTabId); // throws if this tab id no longer exists (new browser session -> new ids)
    await applyToTab(activeTabId, activeTimezone);
    updateBadge(activeTabId, activeTimezone);
  } catch (e) {
    await chrome.storage.local.remove(["activeTimezone", "activeTabId"]);
  }
});
