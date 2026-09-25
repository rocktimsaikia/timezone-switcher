const ACTIVE_BADGE_TEXT = "TZ";
const ACTIVE_BADGE_COLOR = "#3d8743";
const RULE_IDS = [1, 2];

// Session storage clears on browser restart - tab ids don't survive a restart anyway.
const store = chrome.storage.session;

async function getState() {
  const { activeTimezone = null, activeTabId = null } = await store.get(["activeTimezone", "activeTabId"]);
  return { activeTimezone, activeTabId };
}

function updateBadge(tabId, timezone) {
  chrome.action.setBadgeText({ tabId, text: timezone ? ACTIVE_BADGE_TEXT : "" }).catch(() => {});
  if (timezone) chrome.action.setBadgeBackgroundColor({ tabId, color: ACTIVE_BADGE_COLOR }).catch(() => {});
}

// tz-shim.js + tz-boot.js run as a MAIN-world content script at document_start (before any
// page script) on every site, but only act when a `__tzs` cookie is present. These session
// rules add that cookie to document responses in the overridden tab only.
function cookieRule(id, scheme, attrs, tabId, value) {
  return {
    id,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [{ header: "set-cookie", operation: "append", value: `__tzs=${value}; Path=/; Max-Age=30${attrs}` }],
    },
    condition: { tabIds: [tabId], resourceTypes: ["main_frame", "sub_frame"], urlFilter: `|${scheme}:` },
  };
}

async function setCookieRules(tabId, timezone) {
  const value = encodeURIComponent(timezone ?? "");
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: RULE_IDS,
    addRules: timezone
      ? [cookieRule(1, "https", "; SameSite=None; Secure", tabId, value), cookieRule(2, "http", "", tabId, value)]
      : [],
  });
}

async function ensureContentScript() {
  if (!(await chrome.permissions.contains({ origins: ["<all_urls>"] }))) return;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ["tz-shim"] });
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([{
    id: "tz-shim",
    js: ["tz-shim.js", "tz-boot.js"],
    matches: ["<all_urls>"],
    runAt: "document_start",
    world: "MAIN",
    allFrames: true,
    matchOriginAsFallback: true,
  }]);
}
chrome.runtime.onInstalled.addListener(ensureContentScript);

// Reloading gives the tab a fresh document, where the shim either kicks in or no longer does.
async function apply(timezone, tabId) {
  const { activeTabId: prevTabId } = await getState();
  await ensureContentScript();
  await setCookieRules(tabId, timezone);
  await store.set({ activeTimezone: timezone, activeTabId: tabId });
  if (prevTabId !== null && prevTabId !== tabId) {
    updateBadge(prevTabId, null);
    chrome.tabs.reload(prevTabId).catch(() => {});
  }
  updateBadge(tabId, timezone);
  chrome.tabs.reload(tabId).catch(() => {});
}

async function clearState() {
  await setCookieRules(null, null);
  await store.remove(["activeTimezone", "activeTabId"]);
}

async function resetOverride() {
  const { activeTabId } = await getState();
  await clearState();
  if (activeTabId !== null) {
    updateBadge(activeTabId, null);
    chrome.tabs.reload(activeTabId).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "SET_TIMEZONE") {
      await apply(msg.timezone, msg.tabId);
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

// The permission prompt can close the popup before it gets to send SET_TIMEZONE,
// so the popup stashes the request and it's finished here once access is granted.
chrome.permissions.onAdded.addListener(async () => {
  await ensureContentScript();
  const { pendingApply } = await store.get("pendingApply");
  if (!pendingApply) return;
  await store.remove("pendingApply");
  if (Date.now() - pendingApply.at < 60000) await apply(pendingApply.timezone, pendingApply.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  const { activeTimezone, activeTabId } = await getState();
  if (activeTimezone && tabId === activeTabId) updateBadge(tabId, activeTimezone);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { activeTabId } = await getState();
  if (tabId === activeTabId) await clearState();
});
