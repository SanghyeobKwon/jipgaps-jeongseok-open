import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { buildBoundaryRegistry } from "../../app/lib/map/boundary-registry.ts";
import { pointInGeometry } from "../../app/lib/map/geometry.ts";

const load = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"));

test("Seoul registry matches all 25 official district codes, names and interior labels", async () => {
  const registry = buildBoundaryRegistry(await load("public/data/boundaries/sgg/11.json"), "sigungu");
  assert.equal(registry.valid, true, JSON.stringify(registry.issues));
  assert.equal(registry.regions.length, 25);
  assert.equal(new Set(registry.regions.map((region) => region.code)).size, 25);
  assert.ok(registry.regions.some((region) => region.code === "11680" && region.name === "강남구"));
  assert.ok(registry.regions.every((region) => region.sidoCode === "11" && pointInGeometry(region.labelPoint, region.feature.geometry)));
});

test("Incheon and Gyeonggi registries never mix parent codes", async () => {
  for (const [sidoCode, path] of [["28", "public/data/boundaries/sgg/28.json"], ["41", "public/data/boundaries/sgg/41.json"]]) {
    const registry = buildBoundaryRegistry(await load(path), "sigungu");
    assert.equal(registry.valid, true, JSON.stringify(registry.issues));
    assert.ok(registry.regions.length > 0);
    assert.ok(registry.regions.every((region) => region.sidoCode === sidoCode && region.code.startsWith(sidoCode)));
    assert.ok(registry.regions.every((region) => pointInGeometry(region.labelPoint, region.feature.geometry)));
  }
});

test("all bundled province and district boundaries have unique official parent-code mappings", async () => {
  const sido = buildBoundaryRegistry(await load("public/data/boundaries/sido.json"), "sido");
  assert.equal(sido.valid, true, JSON.stringify(sido.issues));
  const files = await readdir(new URL("../../public/data/boundaries/sgg/", import.meta.url));
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const expectedSido = file.slice(0, 2);
    const registry = buildBoundaryRegistry(await load(`public/data/boundaries/sgg/${file}`), "sigungu");
    assert.equal(registry.valid, true, `${file}: ${JSON.stringify(registry.issues)}`);
    assert.ok(registry.regions.every((region) => region.sidoCode === expectedSido && region.code.startsWith(expectedSido)), file);
  }
});

test("registry refuses array-order/name-based mismatches", () => {
  const collection = { type: "FeatureCollection", features: [{ type: "Feature", properties: { code: "11680", name: "강남구", sidoCode: "28", sidoName: "인천광역시", sigunguCode: "11680", sigunguName: "강남구" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } }] };
  const registry = buildBoundaryRegistry(collection, "sigungu");
  assert.equal(registry.valid, false);
  assert.equal(registry.issues[0].reason, "code_hierarchy_mismatch");
});

test("Ulsan EMD accepts the SGIS boundary namespace while preserving official parent codes", async () => {
  const registry = buildBoundaryRegistry(await load("public/data/boundaries/emd/31200.json"), "emd");
  assert.equal(registry.valid, true, JSON.stringify(registry.issues));
  assert.ok(registry.regions.length > 0);
  assert.ok(registry.regions.every((region) => region.code.length === 8));
  assert.ok(registry.regions.every((region) => region.sidoCode === "31" && region.sigunguCode === "31200"));
  assert.ok(registry.regions.some((region) => region.code === "26040510" && region.name === "농소1동"));
});
