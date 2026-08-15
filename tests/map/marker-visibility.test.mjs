import assert from "node:assert/strict";
import test from "node:test";

import { selectVisibleMapMarkerKeys } from "../../app/lib/map/marker-visibility.ts";

const viewport = { south: 37.4, west: 126.8, north: 37.8, east: 127.2 };

function candidates(count) {
  return Array.from({ length: count }, (_, index) => ({
    key: `building-${index}`,
    lat: 37.5 + (index % 10) * 0.001,
    lng: 127 + (index % 10) * 0.001,
    count: index + 1,
    lastAmount: 10_000 + index,
    scope: index % 3 === 0 ? "selected" : "nearby",
  }));
}

test("확대한 지도에서는 화면 안의 매물을 모두 유지한다", () => {
  const visible = selectVisibleMapMarkerKeys(candidates(75), viewport, 4, "");
  assert.equal(visible.size, 75);
});

test("축소한 지도에서는 마커 수를 줄여 이동 성능을 보호한다", () => {
  const visible = selectVisibleMapMarkerKeys(candidates(90), viewport, 7, "");
  assert.equal(visible.size, 28);
});

test("현재 화면 밖 매물은 DOM 오버레이에서 제외한다", () => {
  const visible = selectVisibleMapMarkerKeys([
    ...candidates(3),
    { key: "outside", lat: 35.1, lng: 129.1, count: 999, lastAmount: 999_999, scope: "selected" },
  ], viewport, 4, "outside");
  assert.equal(visible.has("outside"), false);
});

test("같은 화면에서는 선택 매물을 우선 보존한다", () => {
  const rows = candidates(40);
  const visible = selectVisibleMapMarkerKeys(rows, viewport, 7, "building-0");
  assert.equal(visible.has("building-0"), true);
});
