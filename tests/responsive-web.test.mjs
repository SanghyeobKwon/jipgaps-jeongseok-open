import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const page = await readFile(new URL("app/page.tsx", root), "utf8");
const css = await readFile(new URL("app/styles/responsive-web.css", root), "utf8");

test("desktop analysis markup keeps the shortlist, chart and detail contracts", () => {
  for (const className of [
    "market-browser",
    "watchlist",
    "watch-scroll",
    "watch-chart",
    "detail-terminal",
  ]) {
    assert.match(
      page,
      new RegExp('className=(?:"[^"]*|\\{`[^`]*)' + className),
    );
  }

  assert.match(
    page,
    /<\/aside>\s*<section className="watch-chart"[\s\S]*?<div className="detail-terminal">/,
  );
});

test("desktop layout reserves a 320 to 360 pixel candidate rail", () => {
  assert.match(css, /@media\s*\(min-width:\s*1200px\)/);
  assert.match(css, /--web-candidate-width:\s*clamp\(320px,\s*25vw,\s*360px\)/);
  assert.match(
    css,
    /grid-template-columns:\s*var\(--web-candidate-width\)\s+minmax\(0,\s*1fr\)/,
  );
});

test("candidate rail stacks the compact chart below the shortlist", () => {
  assert.match(css, /\.watch-scroll,[\s\S]*?\.watch-state[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /overflow-anchor:\s*none/);
  assert.match(css, /\.watch-chart\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*2/);
  assert.match(css, /height:\s*clamp\(170px,\s*14vw,\s*190px\)/);
  assert.match(css, />\s*\.detail-terminal\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*1\s*\/\s*span\s*2/);
});

test("legacy hidden shortlist selectors are explicitly restored only on desktop", () => {
  for (const selector of [".watch-head", ".watch-filters", ".watch-columns"]) {
    const escaped = selector.replace(".", "\\.");
    assert.match(css, new RegExp(`${escaped}[\\s\\S]*?display: (?:flex|grid) !important`));
  }
  assert.doesNotMatch(css, /@media\s*\(max-width:/);
});
