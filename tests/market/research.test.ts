import assert from "node:assert/strict";
import test from "node:test";

import {
  AREA_BUCKET_SIZE_M2,
  areaBucket,
  buildResearchBundle,
  pricePerPyeong,
  toPyeong,
} from "../../app/lib/market/research.ts";
import type { TradeRecord } from "../../app/lib/market/types.ts";

function trade(
  propertyKey: string,
  name: string,
  date: string,
  amount: number,
  area: number,
  index: number,
  cancelled = false,
): TradeRecord {
  return {
    id: `${propertyKey}-${date}-${index}`,
    date,
    amount,
    area,
    floor: index,
    name,
    propertyKey,
    dong: "청담동",
    buildingDong: `${100 + index}동`,
    jibun: "1-1",
    buildYear: 2000,
    propertyType: "apt",
    dealingType: "중개거래",
    cancelled,
    amountManwon: amount,
    contractDate: date,
    areaMeasurement: { valueM2: area, pyeongEquivalent: toPyeong(area), kind: "exclusive" },
  };
}

const decline = [
  trade("decline", "하락단지", "2025-10-05", 100_000, 84.8, 1),
  trade("decline", "하락단지", "2025-11-05", 100_000, 84.9, 2),
  trade("decline", "하락단지", "2025-12-05", 100_000, 85.0, 3),
  trade("decline", "하락단지", "2026-01-05", 90_000, 84.8, 4),
  trade("decline", "하락단지", "2026-02-05", 90_000, 84.9, 5),
  trade("decline", "하락단지", "2026-03-05", 90_000, 85.0, 6),
];

const growth = [
  trade("growth", "상승단지", "2025-10-10", 100_000, 59.8, 1),
  trade("growth", "상승단지", "2025-11-10", 100_000, 59.9, 2),
  trade("growth", "상승단지", "2025-12-10", 100_000, 60.0, 3),
  trade("growth", "상승단지", "2026-01-10", 120_000, 59.8, 4),
  trade("growth", "상승단지", "2026-02-10", 120_000, 59.9, 5),
  trade("growth", "상승단지", "2026-03-10", 120_000, 60.0, 6),
];

test("전용면적 환산평과 평당가격은 3.305785㎡ 기준을 사용한다", () => {
  assert.ok(Math.abs((toPyeong(84) ?? 0) - 25.41008) < 0.0001);
  assert.ok(Math.abs((pricePerPyeong(100_000, 84) ?? 0) - 3_935.4583) < 0.001);
});

test("면적은 0.5㎡ 그룹으로 묶고 서로 다른 평형은 분리한다", () => {
  assert.equal(AREA_BUCKET_SIZE_M2, 0.5);
  assert.equal(areaBucket(84.8), 85);
  assert.equal(areaBucket(84.9), 85);
  assert.equal(areaBucket(84.4), 84.5);
});

test("6개 리서치 보기는 서로 다른 컬럼과 검증된 순위를 제공한다", () => {
  const cancelled = trade("fake", "취소단지", "2026-03-20", 999_999, 84.9, 1, true);
  const bundle = buildResearchBundle([...decline, ...growth, cancelled], {
    from: "2025-09",
    to: "2026-03",
    minimumSample: 3,
  });

  assert.equal(bundle.status, "ok");
  assert.equal(bundle.rows.length, 2);
  assert.equal(bundle.complexes.length, 2);
  assert.equal(bundle.views.recent_decline.rowIds.length, 1);
  assert.equal(bundle.views.top_growth.rowIds.length, 1);
  assert.notDeepEqual(bundle.views.recent_decline.columns, bundle.views.highest_price.columns);
  assert.equal(bundle.views.highest_price.rowIds[0], bundle.rows.find((row) => row.propertyKey === "growth")?.id);
  assert.equal(bundle.views.recent_decline.rowIds[0], bundle.rows.find((row) => row.propertyKey === "decline")?.id);
  assert.equal(bundle.views.top_growth.rowIds[0], bundle.rows.find((row) => row.propertyKey === "growth")?.id);
  assert.ok(bundle.views.price_per_pyeong.rowIds.length === 2);
  assert.ok(bundle.rows.every((row) => row.areaKind === "exclusive"));
  assert.ok(bundle.rows.every((row) => row.trend.some((point) => point.month === "2025-09" && point.volume === 0)));
  assert.equal(bundle.rows.find((row) => row.propertyKey === "decline")?.lowestTrade?.amountManwon, 90_000);
});

test("가격 변화 순위에서 계산 가능한 변화율이 표본 부족 행보다 먼저 온다", () => {
  const sparse = trade("sparse", "표본부족단지", "2026-03-15", 130_000, 84.9, 1);
  const bundle = buildResearchBundle([...decline, sparse], { from: "2025-10", to: "2026-03" });
  const ordered = bundle.views.price_change.rowIds;
  assert.equal(ordered[0], bundle.rows.find((row) => row.propertyKey === "decline")?.id);
  assert.equal(ordered.at(-1), bundle.rows.find((row) => row.propertyKey === "sparse")?.id);
});

test("표본이 부족하거나 부분 수집된 분기의 변화율은 null이다", () => {
  const low = buildResearchBundle(decline.slice(0, 2).concat(decline.slice(3, 6)), {
    from: "2025-10",
    to: "2026-03",
    minimumSample: 3,
  });
  assert.equal(low.rows[0].previousQuarter.sample.state, "low");
  assert.equal(low.rows[0].changePct, null);
  assert.equal(low.views.recent_decline.rowIds.length, 0);

  const partial = buildResearchBundle(decline, {
    from: "2025-10",
    to: "2026-03",
    minimumSample: 3,
    partialMonths: new Set(["2026-02"]),
    partial: true,
  });
  assert.equal(partial.status, "partial");
  assert.equal(partial.rows[0].currentQuarter.sample.state, "partial");
  assert.equal(partial.rows[0].changePct, null);
});

test("선택 기간 거래가 없으면 빈 리서치 계약을 반환한다", () => {
  const bundle = buildResearchBundle(decline, { from: "2026-04", to: "2026-06" });
  assert.equal(bundle.status, "empty");
  assert.equal(bundle.regionMedianPerPyeongManwon, null);
  assert.equal(bundle.rows.length, 0);
  assert.ok(Object.values(bundle.views).every((view) => view.rowIds.length === 0));
});
