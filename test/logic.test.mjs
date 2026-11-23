import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activitySuggestions, daySegments, estimateEnergy, formatTime, mergeIntervals, openIntervals,
  parseTime, sampleAppliances, sampleWindows, savingsRecommendations, validAppliance,
  validTariff, validWindow,
} from "../logic.mjs";

const interval = (start, end) => ({ start, end });

test("parses minute-precision times, rejects invalid input, and formats midnight boundaries", () => {
  assert.equal(parseTime("00:00"), 0);
  assert.equal(parseTime("09:42"), 582);
  assert.equal(parseTime("23:59"), 1439);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("09:60"), null);
  assert.equal(parseTime("9:42"), null);
  assert.equal(formatTime(582), "09:42");
  assert.equal(formatTime(1440), "24:00");
  assert.equal(validWindow({ day: 0, start: 480, end: 480 }), false);
  assert.equal(validWindow({ day: 8, start: 480, end: 600 }), false);
  assert.equal(validWindow({ day: 1, start: null, end: 600 }), false);
});

test("sample weeks differ by city and supply fresh records with explicit provenance", () => {
  const accra = sampleWindows("Accra");
  assert.ok(accra.length > 0);
  assert.notDeepEqual(accra, sampleWindows("Kumasi"));
  assert.ok(accra.every((window) => window.source === "sample" && validWindow(window)));
  accra[0].start = 0;
  assert.notEqual(sampleWindows("Accra")[0].start, 0);
});

test("splits overnight outages across Sunday and Monday, retaining the original user entry", () => {
  const window = { id: "custom", day: 6, start: 1380, end: 75, source: "user" };
  assert.deepEqual(daySegments([window], 6), [{ ...interval(1380, 1440), window }]);
  assert.deepEqual(daySegments([window], 0), [{ ...interval(0, 75), window }]);
  assert.deepEqual(daySegments([window], 1), []);
  assert.deepEqual(daySegments([{ ...window, end: 0 }], 0), []);
});

test("combines overlapping and adjacent outages without inventing open time", () => {
  const outages = [interval(580, 660), interval(480, 600), interval(660, 730), interval(900, 960)];
  assert.deepEqual(mergeIntervals(outages), [interval(480, 730), interval(900, 960)]);
  assert.deepEqual(openIntervals(outages, 500, 930), [interval(730, 900)]);
  assert.deepEqual(openIntervals([], 500, 930), [interval(500, 930)]);
});

test("picks a charging slot before a planned outage and contiguous appliance and business slots", () => {
  const outages = [interval(480, 600), interval(1080, 1200)];
  assert.deepEqual(activitySuggestions(outages), {
    charge: interval(420, 480), appliances: interval(600, 720), business: interval(600, 1080),
  });
  assert.deepEqual(activitySuggestions([...outages, interval(630, 780)]), {
    charge: interval(420, 480), appliances: interval(780, 900), business: interval(780, 1080),
  });
});

test("handles both empty plans and days with no viable slot", () => {
  assert.deepEqual(activitySuggestions([]), {
    charge: interval(360, 420), appliances: interval(420, 540), business: interval(480, 1080),
  });
  assert.deepEqual(activitySuggestions([interval(0, 1440)]), {
    charge: null, appliances: null, business: null,
  });
});

test("converts watts and hours to daily and 30-day estimates at the entered flat tariff", () => {
  const estimate = estimateEnergy([{ watts: 120, hours: 6 }, { watts: 80, hours: 4 }], 2.5);
  assert.deepEqual(Object.values(estimate).map((value) => value.toFixed(2)),
    ["1.04", "31.20", "2.60", "78.00"]);
  assert.deepEqual(estimateEnergy([], 2), { dailyKwh: 0, monthlyKwh: 0, dailyCost: 0, monthlyCost: 0 });
  assert.equal(estimateEnergy(sampleAppliances(), 0).monthlyCost, 0);
});

test("rejects invalid appliance or tariff inputs and allows zero hours or zero tariff", () => {
  const appliance = { name: "Fan", type: "Fan", watts: 50.5, hours: 0 };
  assert.equal(validAppliance(appliance), true);
  assert.equal(validAppliance({ ...appliance, name: " " }), false);
  assert.equal(validAppliance({ ...appliance, watts: 0 }), false);
  assert.equal(validAppliance({ ...appliance, hours: 25 }), false);
  assert.equal(validAppliance({ ...appliance, type: "unknown" }), false);
  assert.equal(validTariff(0), true);
  assert.equal(validTariff(-1), false);
  assert.equal(validTariff(NaN), false);
});

test("prices each savings scenario and assigns zero savings to time shifting under a flat tariff", () => {
  const values = savingsRecommendations([
    ...sampleAppliances(),
    { name: "AC", type: "Air conditioner", watts: 1000, hours: 4 },
    { name: "Shop freezer", type: "Freezer", watts: 120, hours: 6 },
  ], 2.5);
  assert.deepEqual(values.map(({ monthlyGhs }) => Number(monthlyGhs.toFixed(2))),
    [45, 19.13, 9, 5.4, 4.5, 0]);
  assert.equal(values.at(-1).monthlyKwh, 0);
  assert.equal(savingsRecommendations([{ name: "LED", type: "Lights", watts: 9, hours: 4 }], 2).length, 1);
});
