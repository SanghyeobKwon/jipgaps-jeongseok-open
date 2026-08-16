import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tabletCssUrl = new URL("../app/styles/responsive-tablet.css", import.meta.url);
const css = await readFile(tabletCssUrl, "utf8");

test("tablet CSS owns only the agreed responsive bands", () => {
  assert.match(css, /min-width:\s*960px\)\s+and\s+\(max-width:\s*1199px/);
  assert.match(css, /min-width:\s*768px\)\s+and\s+\(max-width:\s*959px/);
  assert.match(css, /min-width:\s*761px\)\s+and\s+\(max-width:\s*980px/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*767px\)/);
  assert.doesNotMatch(css, /@media\s*\(min-width:\s*1200px\)/);
});

test("large tablets preserve master-detail workspace proportions", () => {
  assert.match(css, /#price-analysis\.market-browser[\s\S]*grid-template-columns:\s*clamp\(320px,\s*31vw,\s*360px\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.map-section \.map-layout[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+clamp\(300px,\s*30vw,\s*352px\)/);
  assert.match(css, /\.field-selector-layout[\s\S]*clamp\(290px,\s*29vw,\s*332px\)/);
});

test("medium tablets keep navigation and move the compact chart beside the shortlist", () => {
  assert.match(css, /\.terminal-shell \.topbar nav\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /#price-analysis\.market-browser\s*\{[\s\S]*grid-template-columns:\s*clamp\(280px,\s*33vw,\s*316px\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.detail-terminal\s*>\s*\.watch-chart\s*\{[\s\S]*order:\s*0/);
  assert.match(css, /\.watch-chart \.canvas-wrap\s*\{[\s\S]*height:\s*200px\s*!important/);
  assert.match(css, /\[data-tablet-panel="drawer"\]/);
  assert.match(css, /\.hmi-drawer/);
});

test("tablet touch and overflow safety remain explicit", () => {
  assert.match(css, /min-block-size:\s*44px/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /orientation:\s*landscape/);
});

test("portrait trade summaries expose four core columns and an expansion hook", () => {
  assert.match(css, /Core columns: contract date, property, area in pyeong, transaction price/);
  assert.match(css, /grid-template-columns:\s*minmax\(78px,\s*0\.8fr\)\s+minmax\(150px,\s*1\.45fr\)\s+minmax\(62px,\s*0\.62fr\)\s+minmax\(112px,\s*1fr\)/);
  assert.match(css, /:nth-child\(3\),\s*:nth-child\(5\),\s*:nth-child\(7\)/);
  assert.match(css, /\[data-trade-expanded="true"\]\s*\+\s*\.trade-row-details/);
});
