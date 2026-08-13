import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("mobile navigation keeps the five product destinations", async () => {
  const page = await read("app/page.tsx");
  const navItems = page.match(/const NAV_ITEMS = \[(.*?)\];/s)?.[1] ?? "";
  const ids = [...navItems.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(ids, ["home", "chart", "research", "community", "policy"]);
  assert.match(page, /className="mobile-primary-nav"/);
});

test("mobile stylesheet locks touch, overflow and progressive disclosure contracts", async () => {
  const css = await read("app/styles/responsive-mobile.css");

  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /--mobile-touch-size:\s*44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.analysis-search-console/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /data-sheet-state="collapsed"/);
  assert.match(css, /data-sheet-state="peek"/);
  assert.match(css, /data-sheet-state="expanded"/);
  assert.match(css, /data-expanded="true"/);
  assert.match(css, /\.pwa-offline-state/);
});

test("PWA manifest uses the existing product identity and a local icon", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  const icon = await read("public/icons/app-icon.svg");

  assert.equal(manifest.name, "집값의 정석");
  assert.equal(manifest.short_name, "집값의 정석");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/#home");
  assert.ok(manifest.icons.some((item) => item.src === "/icons/app-icon.svg"));
  assert.match(icon, /<svg/);
  assert.match(icon, /#155bd7/i);
});
