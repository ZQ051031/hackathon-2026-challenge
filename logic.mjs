export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MINUTES_PER_DAY = 1440;
export const BILLING_DAYS = 30;
export const DEFAULT_TARIFF = 2;

const SAMPLE_PERIODS = {
  Accra: [[0, 8, 10], [0, 18, 20], [1, 12, 15], [3, 7, 10], [4, 18, 22], [6, 14, 16]],
  Kumasi: [[0, 11, 14], [2, 7, 9], [3, 17, 20], [5, 10, 13]],
  Tamale: [[1, 10, 13], [2, 19, 22], [4, 8, 11], [6, 16, 20]],
  Takoradi: [[0, 14, 17], [2, 6, 8], [4, 12, 16], [5, 21, 1]],
  "Cape Coast": [[1, 15, 18], [3, 8, 12], [4, 18, 21], [6, 9, 11]],
};

export const CITIES = Object.keys(SAMPLE_PERIODS);

export function sampleWindows(city) {
  return (SAMPLE_PERIODS[city] ?? []).map(([day, start, end], index) => ({
    id: `sample-${index}`, day, start: start * 60, end: end * 60, source: "sample",
  }));
}

export function parseTime(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(minutes) {
  return [Math.floor(minutes / 60), minutes % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}

export function validWindow({ day, start, end }) {
  return Number.isInteger(day) && day >= 0 && day < DAYS.length &&
    [start, end].every((time) => Number.isInteger(time) && time >= 0 && time < MINUTES_PER_DAY) &&
    start !== end;
}

export function daySegments(windows, day) {
  const previous = (day + DAYS.length - 1) % DAYS.length;
  const segments = [];
  for (const window of windows) {
    if (!validWindow(window)) continue;
    const overnight = window.end < window.start;
    if (window.day === day) {
      segments.push({ window, start: window.start, end: overnight ? MINUTES_PER_DAY : window.end });
    }
    if (overnight && window.day === previous && window.end > 0) {
      segments.push({ window, start: 0, end: window.end });
    }
  }
  return segments.sort((first, second) => first.start - second.start || first.end - second.end);
}

export function mergeIntervals(intervals) {
  const merged = [];
  const ordered = [...intervals].sort((first, second) => first.start - second.start);
  for (const { start, end } of ordered) {
    const previous = merged.at(-1);
    if (previous && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      merged.push({ start, end });
    }
  }
  return merged;
}

export function openIntervals(intervals, from = 0, to = MINUTES_PER_DAY) {
  const available = [];
  let cursor = from;
  for (const { start, end } of mergeIntervals(intervals)) {
    if (end <= from) continue;
    if (start >= to) break;
    if (cursor < start) available.push({ start: cursor, end: start });
    cursor = Math.max(cursor, Math.min(end, to));
  }
  if (cursor < to) available.push({ start: cursor, end: to });
  return available;
}

function longestSlot(slots, minimum) {
  return slots.reduce((best, slot) => {
    const duration = slot.end - slot.start;
    if (duration < minimum || (best && duration <= best.end - best.start)) return best;
    return slot;
  }, null);
}

export function activitySuggestions(intervals) {
  const chargeSlots = openIntervals(intervals, 6 * 60, 22 * 60);
  const beforeOutage = chargeSlots.find((slot) =>
    slot.end - slot.start >= 60 && intervals.some((outage) => outage.start === slot.end));
  const chargeFallback = longestSlot(chargeSlots, 60);
  let charge = null;
  if (beforeOutage) charge = { start: beforeOutage.end - 60, end: beforeOutage.end };
  else if (chargeFallback) charge = { start: chargeFallback.start, end: chargeFallback.start + 60 };

  const applianceSlot = longestSlot(openIntervals(intervals, 7 * 60, 21 * 60), 120);
  return {
    charge,
    appliances: applianceSlot && { start: applianceSlot.start, end: applianceSlot.start + 120 },
    business: longestSlot(openIntervals(intervals, 8 * 60, 18 * 60), 60),
  };
}

export const APPLIANCE_TYPES = [
  "Fridge", "Freezer", "Fan", "Air conditioner", "TV", "Lights", "Water pump", "Iron", "Other",
];

export function sampleAppliances() {
  return [
    { id: "sample-fridge", name: "Fridge", type: "Fridge", watts: 150, hours: 8, source: "sample" },
    { id: "sample-lights", name: "Incandescent bulb", type: "Lights", watts: 60, hours: 5, source: "sample" },
    { id: "sample-tv", name: "TV", type: "TV", watts: 80, hours: 4, source: "sample" },
  ];
}

export function validAppliance({ name, type, watts, hours }) {
  return typeof name === "string" && name.trim().length > 0 && name.length <= 48 &&
    APPLIANCE_TYPES.includes(type) && Number.isFinite(watts) && watts > 0 && watts <= 100000 &&
    Number.isFinite(hours) && hours >= 0 && hours <= 24;
}

export function validTariff(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1000;
}

export function estimateEnergy(appliances, tariff) {
  const dailyKwh = appliances.reduce((total, appliance) =>
    total + appliance.watts * appliance.hours / 1000, 0);
  const monthlyKwh = dailyKwh * BILLING_DAYS;
  return { dailyKwh, monthlyKwh, dailyCost: dailyKwh * tariff, monthlyCost: monthlyKwh * tariff };
}

export function savingsRecommendations(appliances, tariff) {
  const ideas = [];
  for (const appliance of appliances) {
    const { name, type, watts, hours } = appliance;
    const dailyKwh = watts * hours / 1000;
    if (type === "Lights" && watts > 9 && hours > 0) {
      ideas.push({
        title: `Switch ${name} to LED`,
        detail: "For one bulb, model replacing it with a 9 W LED at the same runtime. Check for comparable brightness.",
        dailySaving: (watts - 9) * hours / 1000,
      });
    }
    if (type === "TV" && hours < 24) {
      ideas.push({
        title: `Cut standby power for ${name}`,
        detail: "Switch it off at the socket when idle if your device allows it. Model 3 W of standby draw outside active-use totals.",
        dailySaving: 3 * (24 - hours) / 1000,
      });
    }
    if ((type === "Fridge" || type === "Freezer") && hours > 0) {
      ideas.push({
        title: `Reduce cooling losses for ${name}`,
        detail: "Check door seals, leave airflow around the unit, and limit door openings. Model a 10% reduction in entered energy use.",
        dailySaving: dailyKwh * 0.1,
      });
    }
    if (type === "Air conditioner" && hours > 0) {
      ideas.push({
        title: `Reduce demand from ${name}`,
        detail: "Clean the filter and try a higher thermostat setting when comfortable. Model a 15% reduction in entered energy use.",
        dailySaving: dailyKwh * 0.15,
      });
    }
  }
  const ranked = ideas.map(({ dailySaving, ...idea }) => ({
    ...idea, monthlyKwh: dailySaving * BILLING_DAYS, monthlyGhs: dailySaving * BILLING_DAYS * tariff,
  })).sort((first, second) => second.monthlyKwh - first.monthlyKwh);
  return [...ranked, {
    title: "Shift flexible work around outages",
    detail: "Use the planner for ironing, pumping, or shop equipment. The same kWh costs the same at the flat rate entered here.",
    monthlyKwh: 0, monthlyGhs: 0,
  }];
}
