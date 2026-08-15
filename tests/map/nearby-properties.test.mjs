import assert from "node:assert/strict";
import test from "node:test";

import { selectNearbyPropertyCandidates } from "../../app/lib/map/nearby-properties.ts";

test("선택 동과 주변 법정동 후보를 균형 있게 구성한다", () => {
  const properties = [
    ...Array.from({ length: 20 }, (_, index) => ({ id: `selected-${index}`, dong: "도봉동", count: 100 - index, lastAmount: 10_000 - index })),
    ...Array.from({ length: 10 }, (_, index) => ({ id: `banghak-${index}`, dong: "방학동", count: 80 - index, lastAmount: 9_000 - index })),
    ...Array.from({ length: 10 }, (_, index) => ({ id: `chang-${index}`, dong: "창동", count: 70 - index, lastAmount: 8_000 - index })),
    ...Array.from({ length: 10 }, (_, index) => ({ id: `ssangmun-${index}`, dong: "쌍문동", count: 60 - index, lastAmount: 7_000 - index })),
  ];

  const result = selectNearbyPropertyCandidates(properties, "도봉동");
  assert.equal(result.length, 30);
  assert.equal(result.filter((property) => property.dong === "도봉동").length, 12);
  assert.deepEqual(new Set(result.map((property) => property.dong)), new Set(["도봉동", "방학동", "창동", "쌍문동"]));
});

test("같은 주소의 면적별 거래 후보는 지도 건물 하나로 합친다", () => {
  const properties = [
    { name: "한신", dong: "도봉동", jibun: "30-1", count: 8, lastAmount: 60000 },
    { name: "한신", dong: "도봉동", jibun: "30-1", count: 3, lastAmount: 45000 },
    { name: "주공", dong: "창동", jibun: "1", count: 5, lastAmount: 50000 },
  ];
  const result = selectNearbyPropertyCandidates(properties, "도봉동", 90, 24);
  assert.equal(result.length, 2);
  assert.equal(result.filter((property) => property.name === "한신").length, 1);
});
