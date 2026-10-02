#!/usr/bin/env node
// Screenshots through the ONE PSIM kit's Playwright, but on the Microsoft Edge
// installed in the system. The kit's own scripts/shots.mjs launches its bundled
// Chromium (channel "chromium") only; when that binary cannot start on this
// machine, this does the same job with the same options:
//
//   node tests/shots_edge.mjs --url=<page> --out=<file.png> [--w=1440 --h=900]
//        [--eval=<js>] [--click=<sel,sel,…>] [--hover=<sel>] [--clip=<sel> --pad=8] [--wait=300]
//
// Needs the kit next to this project (../ONE.PSIM.PrototypeKit) with `npm run setup` done,
// and a static server over prototypes/.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = path.resolve(here, "..", "..", "ONE.PSIM.PrototypeKit", "package.json");
const { chromium } = createRequire(kit)("playwright");

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=([\s\S]*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"];
}));
if(!args.url || !args.out){ console.error("Usage: node tests/shots_edge.mjs --url=<page> --out=<file.png> [...]"); process.exit(1); }

const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: +(args.w || 1440), height: +(args.h || 900) },
  deviceScaleFactor: 1, locale: "ru-RU" });
const page = await ctx.newPage();
/* --offline: the half of the kit's `npm run check` that could not run here — every
   request that is not the page's own file is blocked and counted, errors are collected */
const blocked = [], errors = [];
if(args.offline){
  await ctx.route("**/*", r => r.request().url().startsWith("file:") ? r.continue() : (blocked.push(r.request().url()), r.abort()));
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type() === "error") errors.push(m.text()); });
}
await page.goto(args.url, { waitUntil: "load" });
await page.waitForTimeout(300);
/* --eval runs in the page's global scope, so a prototype's top-level state is reachable,
   e.g. --eval="S.lang='ru';render()" */
if(args.eval){ await page.evaluate(args.eval); await page.waitForTimeout(250); }
for(const sel of (args.click || "").split(",").filter(Boolean)){
  await page.locator(sel).first().click();
  await page.waitForTimeout(250);
}
if(args.hover){ await page.locator(args.hover).first().hover(); await page.waitForTimeout(200); }
await page.waitForTimeout(+(args.wait || 300));
if(args.clip){
  const box = await page.locator(args.clip).first().boundingBox();
  if(!box) throw new Error(`--clip matched nothing: ${args.clip}`);
  const pad = +(args.pad || 8);
  await page.screenshot({ path: args.out, clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
    width: box.width + pad * 2, height: box.height + pad * 2 } });
} else await page.screenshot({ path: args.out });
if(args.offline){
  const inter = await page.evaluate(() => document.fonts.check('12px Inter'));
  console.log(`offline: ${blocked.length} network requests, ${errors.length} errors, Inter loaded: ${inter}`);
  blocked.concat(errors).forEach(x => console.log("  " + x));
}
await browser.close();
console.log("saved", args.out);
