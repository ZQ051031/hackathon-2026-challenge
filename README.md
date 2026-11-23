# Dumsor Planner

Dumsor Planner is a free, offline-capable web app for Ghanaian households and small businesses planning around intermittent electricity. It pairs a weekly outage plan with an appliance cost estimator in Ghana cedis.

[DoraHacks event page](https://dorahacks.io/hackathon/hackathon2026challenge/detail) · [GitHub repository](https://github.com/ZQ051031/hackathon-2026-challenge) · [GitHub Pages URL](https://zq051031.github.io/hackathon-2026-challenge/)

## What it does

- **Plan the week.** Choose Accra, Kumasi, Tamale, Takoradi, or Cape Coast. Open any weekday to review its windows, then add, edit, or remove entries. Changes belong to the selected city. A window can continue past midnight into the next day.
- **Find time for essential work.** Compare suggested times for charging phones and power banks, running high-power appliances, and operating a small business. Within daytime planning hours, the planner favors charging before an outage and finds continuous slots between recorded outages for appliances and business tasks.
- **Estimate electricity use and cost.** Enter an appliance's running watts and average hours of use per day, then set your own rate in GHS/kWh. For cycling equipment, use an average draw over the entered hours or estimate its active runtime at the entered wattage. The optimizer shows daily and 30-day energy and cost estimates, plus itemized savings scenarios.
- **Keep working offline.** Wait for **Offline ready** after the first online visit. JavaScript, fonts, and imagery are served from the same site and cached by its service worker. The browser stores edits and the selected city locally. The app uses no backend, accounts, paid APIs, API keys, analytics, or tracking.

## Ghana and regional impact

A shopkeeper can move pumping, ironing, or other power-dependent jobs to a longer opening in their plan. A household can charge ahead of a planned power cut and compare the cedi savings of changing a bulb or reducing cooling losses. The offline design supports use during intermittent connectivity. The planning approach can extend to other communities in Africa using their local time, currency, and user-supplied electricity rates.

## Data and assumptions

- All starter outages are **sample planning data** created for the prototype. All edits are **user-entered planning data**. There is no real or live Electricity Company of Ghana (ECG) grid data or guarantee of service. Open time only means the plan has no recorded outage. The sample and user-entered windows repeat weekly in Ghana time (GMT).
- Starter appliances are examples. The pre-filled **GHS 2.00/kWh estimate** is an illustrative flat rate. It is not an official or current tariff. Replace it with the energy rate you want to model.
- Daily kWh equals running watts × hours per day ÷ 1,000. Monthly kWh uses 30 days. Multiply by the rate for an estimated cost. Fixed fees, tiered pricing, and taxes are excluded.
- Savings are individual estimates based on stated assumptions. The TV standby scenario is separate from active-use totals. Moving an unchanged load around an outage saves **an estimated GHS 0.00** at a flat rate and can still help avoid interruptions.
- The hero image is an AI-generated illustration of an Accra neighborhood. The locally hosted Instrument Sans font is distributed under the [SIL Open Font License](assets/OFL-Instrument-Sans.txt).

## Run locally

From the repository root, serve the static files with Python 3.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://localhost:8000/](http://localhost:8000/). Offline caching requires HTTPS or localhost. The same files can be served directly from the root of `main` in GitHub Pages. There is no build step.

## Run tests

Use Node.js 20 or newer. There are no dependencies to install.

```sh
node --test
```

The tests cover time validation, overnight and overlapping outages, schedule recommendations, tariff and appliance validation, energy and savings math, and serving the app and its assets under the GitHub Pages project path.

## Hackathon 2026 Challenge

TechHub Africa LLC runs the virtual event on DoraHacks for ages 15–25. Solo entries are allowed. The tracks are **Electricity Efficiency** (this entry), Traffic Mitigation, and Pollution Control.

- Prize pool is **$1,000 USD**, with **$450** for 1st, **$300** for 2nd, and **$250** for 3rd.
- The timeline header lists **Dec 19, 2026 at 04:20 Singapore time (UTC+8)**, equivalent to **Dec 18, 2026 at 20:20 UTC/GMT**. The program write-up also lists **Oct 31 at 11:59 p.m. GMT**. DoraHacks shows both dates.
- The event requires a repository link and a pre-recorded demo video. The [demo script](DEMO_SCRIPT.md) is ready to record. [Official rules and event timeline](https://dorahacks.io/hackathon/hackathon2026challenge/detail)

| Judging criterion | Points | How Dumsor Planner addresses it |
| --- | ---: | --- |
| Design & Technological Implementation | 5 | Responsive screens with labeled inputs, keyboard navigation, local storage, and offline support on static hosting. |
| Technical Complexity | 5 | Splits overnight entries across days, merges overlapping outages, searches for continuous activity slots, and recalculates cost scenarios with tests for the core logic. |
| Potential Impact | 5 | Helps households and small businesses plan power-dependent work and make energy decisions in GHS, including when connectivity is intermittent. |
| Quality & Innovation of the Idea | 5 | Pairs interruption planning with energy efficiency decisions and makes the sample, user-entered, and estimated inputs visible throughout. |
| **Total** | **20** | |
