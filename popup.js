let tzData = {};
let nameToCode = new Map();

const countryInput = document.getElementById("country");
const countryDropdown = document.getElementById("country-dropdown");
const timezoneSelect = document.getElementById("timezone");
const applyBtn = document.getElementById("apply");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");

function offsetLabel(zone) {
  const part = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part ? part.value.replace("GMT", "UTC") : "";
}

function cityLabel(zone) {
  return zone.split("/").pop().replace(/_/g, " ");
}

function populateTimezones(code, selectZone) {
  const zones = tzData[code]?.zones ?? [];
  timezoneSelect.innerHTML = "";
  for (const zone of zones) {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = `${cityLabel(zone)} (${offsetLabel(zone)})`;
    timezoneSelect.appendChild(opt);
  }
  timezoneSelect.disabled = zones.length === 0;
  applyBtn.disabled = zones.length === 0;
  if (selectZone) timezoneSelect.value = selectZone;
}

function findCodeForZone(zone) {
  for (const [code, entry] of Object.entries(tzData)) {
    if (entry.zones.includes(zone)) return code;
  }
  return null;
}

function setStatus(activeZone, isCurrentTab) {
  if (activeZone) {
    statusEl.className = "status status-on";
    const where = isCurrentTab ? "" : " (on another tab)";
    statusText.textContent = `Active - ${cityLabel(activeZone)} (${offsetLabel(activeZone)})${where}`;
  } else {
    statusEl.className = "status status-off";
    statusText.textContent = "Off - using system timezone";
  }
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function selectCountry(name) {
  countryInput.value = name;
  countryDropdown.classList.add("hidden");
  const code = nameToCode.get(name);
  if (code) populateTimezones(code);
}

function renderDropdown(filter) {
  const q = filter.trim().toLowerCase();
  const matches = [...nameToCode.keys()].filter((name) => name.toLowerCase().includes(q));
  countryDropdown.innerHTML = "";
  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dropdown-empty";
    empty.textContent = "No matching country";
    countryDropdown.appendChild(empty);
  } else {
    for (const name of matches) {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.textContent = name;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus so the click registers before any blur-hide
        selectCountry(name);
      });
      countryDropdown.appendChild(item);
    }
  }
  countryDropdown.classList.remove("hidden");
}

countryInput.addEventListener("input", () => {
  renderDropdown(countryInput.value);
  if (!nameToCode.has(countryInput.value)) {
    timezoneSelect.innerHTML = "";
    timezoneSelect.disabled = true;
    applyBtn.disabled = true;
  }
});

countryInput.addEventListener("focus", () => renderDropdown(countryInput.value));

document.addEventListener("click", (e) => {
  if (e.target !== countryInput) countryDropdown.classList.add("hidden");
});

applyBtn.addEventListener("click", async () => {
  const zone = timezoneSelect.value;
  if (!zone) return;
  applyBtn.disabled = true;
  const tab = await getCurrentTab();
  await chrome.runtime.sendMessage({ type: "SET_TIMEZONE", timezone: zone, tabId: tab.id });
  applyBtn.disabled = false;
  setStatus(zone, true);
});

resetBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CLEAR_TIMEZONE" });
  setStatus(null);
});

(async () => {
  tzData = await fetch("data/tz-data.json").then((r) => r.json());
  for (const [code, entry] of Object.entries(tzData)) {
    nameToCode.set(entry.name, code);
  }

  const [{ activeTimezone, activeTabId }, currentTab] = await Promise.all([
    chrome.runtime.sendMessage({ type: "GET_STATE" }),
    getCurrentTab(),
  ]);
  setStatus(activeTimezone, activeTabId === currentTab.id);
  if (activeTimezone) {
    const code = findCodeForZone(activeTimezone);
    if (code) {
      countryInput.value = tzData[code].name;
      populateTimezones(code, activeTimezone);
    }
  }
})();
