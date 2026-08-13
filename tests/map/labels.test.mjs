import test from "node:test";
import assert from "node:assert/strict";
import { resolveLabelCollisions } from "../../app/lib/map/labels.ts";

test("collision resolver keeps selected then local labels and clips viewport overflow", () => {
  const labels = resolveLabelCollisions([
    { id: "sido:41", name: "경기도", point: [50, 50], level: "sido" },
    { id: "sgg:11680", name: "강남구", point: [50, 50], level: "sigungu", selected: true },
    { id: "sgg:11650", name: "서초구", point: [120, 50], level: "sigungu", sameParent: true },
    { id: "sgg:edge", name: "화면밖", point: [2, 2], level: "sigungu" },
  ], ([x, y]) => ({ x, y }), { width: 180, height: 100 });
  assert.deepEqual(labels.map((label) => label.id), ["sgg:11680", "sgg:11650"]);
});
