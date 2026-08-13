import test from "node:test";
import assert from "node:assert/strict";
import { regionSelectionFromBoundary, selectionToQuery } from "../../app/lib/map/region-selection.ts";

const region = (level, code, name, sidoCode, sidoName, sigunguCode, sigunguName) => ({ id: `${level}:${code}`, level, code, name, sidoCode, sidoName, sigunguCode, sigunguName, labelPoint: [0, 0], feature: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [] } } });

test("clicking another province clears stale district, dong and property state", () => {
  const current = { level: "emd", sidoCode: "11", sidoName: "서울특별시", sigunguCode: "11680", sigunguName: "강남구", boundaryAdminCode: "11230590", adminDongName: "청담동", propertyKey: "apt|1" };
  const change = regionSelectionFromBoundary(region("sido", "28", "인천광역시", "28", "인천광역시"), current);
  assert.equal(change.selection.sidoName, "인천광역시");
  assert.equal(change.selection.sigunguCode, undefined);
  assert.deepEqual(change.cleared, ["sigungu", "dong", "property", "area", "tradePy"]);
  assert.equal(change.history, "push");
});

test("clicking a neighboring Gyeonggi district selects its parent and does not retain Seoul", () => {
  const change = regionSelectionFromBoundary(region("sigungu", "41135", "성남시분당구", "41", "경기도", "41135", "성남시분당구"));
  assert.deepEqual(change.selection, { level: "sigungu", sidoCode: "41", sidoName: "경기도", sigunguCode: "41135", sigunguName: "성남시분당구" });
  assert.equal(selectionToQuery(change.selection).get("sido"), "경기도");
  assert.equal(selectionToQuery(change.selection).get("sigungu"), "41135");
});

test("reselecting the same region preserves camera/history contract", () => {
  const current = { level: "sigungu", sidoCode: "11", sidoName: "서울특별시", sigunguCode: "11680", sigunguName: "강남구", camera: { lat: 37.5, lng: 127.05, level: 7 } };
  const change = regionSelectionFromBoundary(region("sigungu", "11680", "강남구", "11", "서울특별시", "11680", "강남구"), current);
  assert.deepEqual(change.cleared, []);
  assert.equal(change.history, "replace");
  assert.deepEqual(change.selection.camera, current.camera);
});
