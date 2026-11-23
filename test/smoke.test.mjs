import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";

const files = new Map([
  ["index.html", "text/html"],
  ["styles.css", "text/css"],
  ["app.mjs", "text/javascript"],
  ["logic.mjs", "text/javascript"],
  ["sw.js", "text/javascript"],
  ["assets/accra-dusk.webp", "image/webp"],
  ["assets/icon.png", "image/png"],
  ["assets/instrument-sans.woff2", "font/woff2"],
]);

test("the static app and its offline assets load under the GitHub Pages project path", async (t) => {
  const prefix = "/hackathon-2026-challenge/";
  const server = createServer(async (request, response) => {
    const path = request.url?.startsWith(prefix) && (request.url.slice(prefix.length) || "index.html");
    if (!files.has(path)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(new URL(`../${path}`, import.meta.url));
      response.writeHead(200, { "Content-Type": files.get(path) }).end(body);
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<html lang="en-US">/);
  assert.match(html, /<title>Dumsor Planner<\/title>/);
  for (const id of ["planner", "week-days", "outage-form", "optimizer", "appliance-form", "tariff", "energy-totals", "savings-list"]) {
    assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  }
  assert.match(html, /No real or live ECG grid data/);
  assert.match(html, /Estimate · illustrative flat rate/);
  for (const path of files.keys()) {
    const asset = await fetch(new URL(path, base));
    assert.equal(asset.status, 200, path);
    assert.ok((await asset.arrayBuffer()).byteLength > 0, path);
  }
});
