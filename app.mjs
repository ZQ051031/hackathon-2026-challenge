import {
  APPLIANCE_TYPES, CITIES, DAYS, DEFAULT_TARIFF, MINUTES_PER_DAY, activitySuggestions,
  daySegments, estimateEnergy, formatTime, parseTime, sampleAppliances, sampleWindows,
  savingsRecommendations, validAppliance, validTariff, validWindow,
} from "./logic.mjs";

const STORAGE_KEY = "dumsor-planner-v1";
const $ = (id) => document.getElementById(id);
const citySelect = $("city");
const outageForm = $("outage-form");
const openOutage = $("open-outage");
const applianceForm = $("appliance-form");
const openAppliance = $("open-appliance");
const tariffInput = $("tariff");
const twoDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputNumber = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 8 });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readState() {
  const initial = {
    city: CITIES[0],
    schedules: Object.fromEntries(CITIES.map((city) => [city, sampleWindows(city)])),
    appliances: sampleAppliances(),
    tariff: DEFAULT_TARIFF,
    tariffSource: "estimate",
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return initial;
    if (CITIES.includes(saved.city)) initial.city = saved.city;
    for (const city of CITIES) {
      const schedule = saved.schedules?.[city];
      if (Array.isArray(schedule)) initial.schedules[city] = schedule.filter((entry) => hasSource(entry) && validWindow(entry));
    }
    if (Array.isArray(saved.appliances)) {
      initial.appliances = saved.appliances.filter((entry) => hasSource(entry) && validAppliance(entry));
    }
    if (saved.tariffSource === "user" && validTariff(saved.tariff)) {
      initial.tariff = saved.tariff;
      initial.tariffSource = "user";
    }
  } catch {
    $("storage-warning").hidden = false;
  }
  return initial;
}

function hasSource(entry) {
  return entry && typeof entry.id === "string" && ["sample", "user"].includes(entry.source);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("storage-warning").hidden = true;
  } catch {
    $("storage-warning").hidden = false;
  }
}

const state = readState();
let selectedDay = 0;
let editingOutage = null;
let editingAppliance = null;

function announce(message) {
  $("announcer").textContent = message;
}

function addOptions(select, values, optionValue = (text) => text) {
  values.forEach((text, index) => {
    const option = element("option", "", text);
    option.value = optionValue(text, index);
    select.append(option);
  });
}

function rowButton(label, target, action) {
  const button = element("button", "text-button", label);
  button.type = "button";
  button.setAttribute("aria-label", `${label} ${target}`);
  button.addEventListener("click", action);
  return button;
}

function sourceTag(source) {
  return element("span", `tag ${source}`, source === "sample" ? "Sample" : "User-entered");
}

function newId() {
  return crypto.getRandomValues(new Uint32Array(4)).join("-");
}

function range({ start, end }) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

function weekButton(day, index) {
  const button = element("button", "day-button");
  const label = element("span", "", day.slice(0, 3));
  const track = element("span", "track");
  label.setAttribute("aria-hidden", "true");
  track.setAttribute("aria-hidden", "true");
  button.type = "button";
  button.setAttribute("aria-controls", "activities outage-list");
  button.append(label, track);
  button.addEventListener("click", () => {
    selectedDay = index;
    renderPlanner();
    announce(`${day} plan displayed.`);
  });
  $("week-days").append(button);
  return { button, track };
}

const weekButtons = DAYS.map(weekButton);

function renderPlanner() {
  const week = DAYS.map((_, index) => daySegments(state.schedules[state.city], index));
  for (const [index, { button, track }] of weekButtons.entries()) {
    const segments = week[index];
    const count = (source) => segments.filter(({ window }) => window.source === source).length;
    button.setAttribute("aria-pressed", String(index === selectedDay));
    button.setAttribute("aria-label", `${DAYS[index]}, ${count("sample")} sample and ${count("user")} user-entered outage windows`);
    const ticks = [25, 50, 75].map((value) => {
      const tick = element("span", "track-tick");
      tick.style.left = `${value}%`;
      return tick;
    });
    const bars = ["sample", "user"].flatMap((source) => segments
      .filter(({ window }) => window.source === source)
      .map(({ start, end }) => {
        const bar = element("span", `track-window ${source}`);
        bar.style.left = `${start / MINUTES_PER_DAY * 100}%`;
        bar.style.width = `${(end - start) / MINUTES_PER_DAY * 100}%`;
        return bar;
      }));
    track.replaceChildren(...ticks, ...bars);
  }
  $("day-title").textContent = `${DAYS[selectedDay]} plan`;
  const segments = week[selectedDay];
  renderActivities(activitySuggestions(segments));
  renderOutages(segments);
}

function renderActivities({ charge, appliances, business }) {
  const entries = [
    ["↯", "Charge phones & power banks", charge, "No open 1-hour slot between 06:00 and 22:00."],
    ["◷", "Run high-power appliances", appliances, "No open 2-hour slot between 07:00 and 21:00."],
    ["▦", "Keep a small business running", business, "No open 1-hour slot between 08:00 and 18:00."],
  ];
  $("activities").replaceChildren(...entries.map(([icon, title, slot, empty]) => {
    const row = element("li");
    const mark = element("span", "activity-icon", icon);
    mark.setAttribute("aria-hidden", "true");
    const content = element("div");
    content.append(element("strong", "", title), element("p", slot ? "time-value" : "", slot ? range(slot) : empty));
    row.append(mark, content);
    return row;
  }));
}

function renderOutages(segments) {
  const list = $("outage-list");
  if (!segments.length) {
    list.replaceChildren(element("li", "empty", "No outages recorded for this day."));
    return;
  }
  list.replaceChildren(...segments.map((segment) => {
    const row = element("li");
    const info = element("div");
    const actions = element("div", "row-actions");
    const time = range(segment);
    const target = `${time} ${segment.window.source === "sample" ? "sample" : "user-entered"} outage`;
    info.append(element("strong", "", time), sourceTag(segment.window.source));
    actions.append(
      rowButton("Edit", target, () => showOutageForm(segment.window)),
      rowButton("Remove", target, () => removeOutage(segment.window.id)),
    );
    row.append(info, actions);
    return row;
  }));
}

function showOutageForm(window) {
  editingOutage = window?.id ?? null;
  outageForm.reset();
  $("outage-end").setCustomValidity("");
  $("outage-form-title").textContent = window ? "Edit outage" : "Add outage";
  $("outage-day").value = window?.day ?? selectedDay;
  $("outage-start").value = window ? formatTime(window.start) : "";
  $("outage-end").value = window ? formatTime(window.end) : "";
  outageForm.hidden = false;
  openOutage.setAttribute("aria-expanded", "true");
  $("outage-day").focus();
}

function closeOutageForm() {
  editingOutage = null;
  outageForm.hidden = true;
  openOutage.setAttribute("aria-expanded", "false");
}

function removeOutage(id) {
  state.schedules[state.city] = state.schedules[state.city].filter((window) => window.id !== id);
  if (editingOutage === id) closeOutageForm();
  saveState();
  renderPlanner();
  weekButtons[selectedDay].button.focus();
  announce("Outage removed from your plan.");
}

function renderAppliances() {
  const list = $("appliance-list");
  if (!state.appliances.length) {
    list.replaceChildren(element("li", "empty", "No appliances added. Add one to start an estimate."));
    return;
  }
  list.replaceChildren(...state.appliances.map((appliance) => {
    const row = element("li");
    const info = element("div");
    const actions = element("div", "row-actions");
    const watts = inputNumber.format(appliance.watts);
    const hours = inputNumber.format(appliance.hours);
    info.append(
      element("strong", "", appliance.name),
      sourceTag(appliance.source),
      element("p", "", `${appliance.type} · ${watts} W · ${hours} h/day`),
    );
    actions.append(
      rowButton("Edit", appliance.name, () => showApplianceForm(appliance)),
      rowButton("Remove", appliance.name, () => removeAppliance(appliance.id)),
    );
    row.append(info, actions);
    return row;
  }));
}

function showApplianceForm(appliance) {
  editingAppliance = appliance?.id ?? null;
  applianceForm.reset();
  $("appliance-name").setCustomValidity("");
  $("appliance-watts").setCustomValidity("");
  $("appliance-form-title").textContent = appliance ? "Edit appliance" : "Add appliance";
  $("appliance-name").value = appliance?.name ?? "";
  $("appliance-type").value = appliance?.type ?? "Other";
  $("appliance-watts").value = appliance?.watts ?? "";
  $("appliance-hours").value = appliance?.hours ?? "";
  applianceForm.hidden = false;
  openAppliance.setAttribute("aria-expanded", "true");
  $("appliance-name").focus();
}

function closeApplianceForm() {
  editingAppliance = null;
  applianceForm.hidden = true;
  openAppliance.setAttribute("aria-expanded", "false");
}

function removeAppliance(id) {
  state.appliances = state.appliances.filter((appliance) => appliance.id !== id);
  if (editingAppliance === id) closeApplianceForm();
  saveState();
  renderAppliances();
  renderEstimates();
  openAppliance.focus();
  announce("Appliance removed. Energy estimates updated.");
}

function renderEstimates() {
  const { dailyKwh, monthlyKwh, dailyCost, monthlyCost } = estimateEnergy(state.appliances, state.tariff);
  const metrics = [
    ["Daily usage estimate", `${twoDecimals.format(dailyKwh)} kWh`],
    ["Monthly usage estimate", `${twoDecimals.format(monthlyKwh)} kWh`],
    ["Daily cost estimate", `GHS ${twoDecimals.format(dailyCost)}`],
    ["Monthly cost estimate", `GHS ${twoDecimals.format(monthlyCost)}`],
  ];
  $("energy-totals").replaceChildren(...metrics.map(([label, value]) => {
    const item = element("div");
    item.append(element("dt", "", label), element("dd", "", value));
    return item;
  }));
  $("savings-list").replaceChildren(...savingsRecommendations(state.appliances, state.tariff)
    .map(({ title, detail, monthlyGhs, monthlyKwh }) => {
      const item = element("li", "card");
      item.append(
        element("h4", "", title),
        element("p", "", detail),
        element("p", "savings-value", `Estimated savings · GHS ${twoDecimals.format(monthlyGhs)}/month · ${twoDecimals.format(monthlyKwh)} kWh/month`),
      );
      return item;
    }));
  return monthlyCost;
}

function renderTariffHint() {
  $("tariff-hint").textContent = state.tariffSource === "user"
    ? "User-entered flat rate · used for estimates."
    : "Estimate · illustrative flat rate. Enter the rate from your bill.";
}

addOptions(citySelect, CITIES);
addOptions($("outage-day"), DAYS, (_day, index) => index);
addOptions($("appliance-type"), APPLIANCE_TYPES);
citySelect.value = state.city;
tariffInput.value = state.tariffSource === "estimate" ? DEFAULT_TARIFF.toFixed(2) : state.tariff;
renderPlanner();
renderAppliances();
renderTariffHint();
renderEstimates();

citySelect.addEventListener("change", () => {
  state.city = citySelect.value;
  closeOutageForm();
  saveState();
  renderPlanner();
  announce(`${state.city} weekly plan displayed.`);
});

openOutage.addEventListener("click", () => showOutageForm());
$("cancel-outage").addEventListener("click", () => {
  closeOutageForm();
  openOutage.focus();
});
for (const id of ["outage-start", "outage-end"]) {
  $(id).addEventListener("input", () => $("outage-end").setCustomValidity(""));
}
outageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const window = {
    id: editingOutage ?? newId(),
    day: Number($("outage-day").value),
    start: parseTime($("outage-start").value),
    end: parseTime($("outage-end").value),
    source: "user",
  };
  if (!validWindow(window)) {
    $("outage-end").setCustomValidity("Choose an end time different from the start time.");
    $("outage-end").reportValidity();
    return;
  }
  const windows = state.schedules[state.city];
  state.schedules[state.city] = editingOutage
    ? windows.map((existing) => existing.id === editingOutage ? window : existing)
    : [...windows, window];
  selectedDay = window.day;
  closeOutageForm();
  saveState();
  renderPlanner();
  weekButtons[selectedDay].button.focus();
  announce(`Outage saved for ${DAYS[selectedDay]}. Suggested times updated.`);
});

openAppliance.addEventListener("click", () => showApplianceForm());
$("cancel-appliance").addEventListener("click", () => {
  closeApplianceForm();
  openAppliance.focus();
});
for (const id of ["appliance-name", "appliance-watts"]) {
  $(id).addEventListener("input", () => $(id).setCustomValidity(""));
}
applianceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const appliance = {
    id: editingAppliance ?? newId(),
    name: $("appliance-name").value.trim(),
    type: $("appliance-type").value,
    watts: $("appliance-watts").valueAsNumber,
    hours: $("appliance-hours").valueAsNumber,
    source: "user",
  };
  if (!validAppliance(appliance)) {
    const field = appliance.name ? $("appliance-watts") : $("appliance-name");
    field.setCustomValidity(appliance.name ? "Enter a wattage greater than zero." : "Enter an appliance name.");
    field.reportValidity();
    return;
  }
  state.appliances = editingAppliance
    ? state.appliances.map((existing) => existing.id === editingAppliance ? appliance : existing)
    : [...state.appliances, appliance];
  closeApplianceForm();
  saveState();
  renderAppliances();
  renderEstimates();
  openAppliance.focus();
  announce(`${appliance.name} saved. Energy estimates updated.`);
});

tariffInput.addEventListener("input", () => {
  const rate = tariffInput.valueAsNumber;
  if (!validTariff(rate)) {
    const source = state.tariffSource === "estimate" ? "illustrative estimate" : "user-entered rate";
    $("tariff-hint").textContent = `Enter a rate from 0 to 1,000 GHS/kWh. Using GHS ${inputNumber.format(state.tariff)}/kWh (${source}).`;
    return;
  }
  state.tariff = rate;
  state.tariffSource = "user";
  saveState();
  renderTariffHint();
  renderEstimates();
});
tariffInput.addEventListener("change", () => {
  if (!validTariff(tariffInput.valueAsNumber)) {
    announce($("tariff-hint").textContent);
    return;
  }
  const { monthlyCost } = estimateEnergy(state.appliances, state.tariff);
  announce(`Updated monthly cost estimate: GHS ${twoDecimals.format(monthlyCost)}.`);
});

const offlineStatus = $("offline-status");
function showOfflineReady() {
  offlineStatus.textContent = navigator.onLine ? "Offline ready" : "Offline mode";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then((registration) => {
      const { installing } = registration;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "redundant" && !registration.active) {
          offlineStatus.textContent = "Offline setup unavailable";
        }
      });
      return navigator.serviceWorker.ready;
    })
    .then(() => {
      showOfflineReady();
      addEventListener("online", showOfflineReady);
      addEventListener("offline", showOfflineReady);
    })
    .catch(() => { offlineStatus.textContent = "Offline setup unavailable"; });
} else {
  offlineStatus.textContent = "Offline setup unavailable";
}
