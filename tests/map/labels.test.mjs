import test from "node:test";
import assert from "node:assert/strict";
import { officialRegionLabelCandidates, resolveLabelCollisions, resolveRegionLabelLayout } from "../../app/lib/map/labels.ts";

test("collision resolver keeps selected then local labels and clips viewport overflow", () => {
  const labels = resolveLabelCollisions([
    { id: "sido:41", code: "41", name: "경기도", point: [50, 50], level: "sido" },
    { id: "sgg:11680", code: "11680", name: "강남구", point: [50, 50], level: "sigungu", selected: true },
    { id: "sgg:11650", code: "11650", name: "서초구", point: [120, 50], level: "sigungu", sameParent: true },
    { id: "sgg:edge", code: "edge", name: "화면밖", point: [2, 2], level: "sigungu" },
  ], ([x, y]) => ({ x, y }), { width: 180, height: 100 });
  assert.deepEqual(labels.map((label) => label.id), ["sgg:11680", "sgg:11650"]);
});

test("selected label remains visible and collided official labels become interactive fallbacks", () => {
  const layout = resolveRegionLabelLayout([
    { id: "emd:1", code: "1", name: "선택동", point: [-10, 50], level: "emd", selected: true },
    { id: "emd:2", code: "2", name: "주변동", point: [0, 50], level: "emd", sameParent: true },
  ], ([x, y]) => ({ x, y }), { width: 100, height: 100 });
  assert.equal(layout.visible[0].id, "emd:1");
  assert.equal(layout.visible[0].x, layout.visible[0].width / 2);
  assert.deepEqual(layout.fallback.map(({ id, reason }) => ({ id, reason })), [{ id: "emd:2", reason: "outside_viewport" }]);
});

test("official candidate builder keeps code, name and an interior label point", () => {
  const feature = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] } };
  const candidates = officialRegionLabelCandidates([{ id: "emd:11230640", level: "emd", code: "11230640", name: "역삼1동", sidoCode: "11", sidoName: "서울특별시", sigunguCode: "11680", sigunguName: "강남구", labelPoint: [2, 2], feature }], { selectedCode: "11230640" });
  assert.deepEqual(candidates.map(({ code, name, selected }) => ({ code, name, selected })), [{ code: "11230640", name: "역삼1동", selected: true }]);
});
