import assert from "node:assert/strict";
import test from "node:test";

import { median, monthlySeries, rollingQuarter } from "../../app/lib/market/aggregate.ts";

const row = (date: string, amount: number, area = 84) => ({ date, amount, area });

test("중위값은 빈 표본을 0으로 대체하지 않는다", () => {
  assert.equal(median([]), null);
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([40, 10, 30, 20]), 25);
});

test("월 집계는 거래가 없는 달도 null 가격과 0건으로 유지한다", () => {
  const points = monthlySeries([row("2026-01-12", 100), row("2026-03-02", 300)], "2026-01", "2026-03");
  assert.deepEqual(points.map(({ month, medianAmountManwon, volume, sample }) => ({ month, medianAmountManwon, volume, state: sample.state })), [
    { month: "2026-01", medianAmountManwon: 100, volume: 1, state: "low" },
    { month: "2026-02", medianAmountManwon: null, volume: 0, state: "none" },
    { month: "2026-03", medianAmountManwon: 300, volume: 1, state: "low" },
  ]);
});

test("최근 분기 0건은 과거 가격으로 대체하지 않는다", () => {
  const aggregate = rollingQuarter([row("2025-12-10", 90), row("2025-12-11", 100), row("2025-12-12", 110)], "2026-03");
  assert.equal(aggregate.current.volume, 0);
  assert.equal(aggregate.current.medianAmountManwon, null);
  assert.equal(aggregate.changePct, null);
});

test("양쪽 분기 표본이 충분할 때만 변화율을 계산한다", () => {
  const enough = rollingQuarter([
    row("2025-10-01", 100), row("2025-11-01", 100), row("2025-12-01", 100),
    row("2026-01-01", 110), row("2026-02-01", 110), row("2026-03-01", 110),
  ], "2026-03");
  assert.ok(Math.abs((enough.changePct ?? 0) - 10) < 1e-9);

  const low = rollingQuarter([
    row("2025-10-01", 100), row("2025-11-01", 100),
    row("2026-01-01", 110), row("2026-02-01", 110), row("2026-03-01", 110),
  ], "2026-03");
  assert.equal(low.previous.sample.state, "low");
  assert.equal(low.changePct, null);
});

test("부분 수집 월이 포함되면 변화율을 숨긴다", () => {
  const aggregate = rollingQuarter([
    row("2025-10-01", 100), row("2025-11-01", 100), row("2025-12-01", 100),
    row("2026-01-01", 110), row("2026-02-01", 110), row("2026-03-01", 110),
  ], "2026-03", 3, new Set(["2026-02"]));
  assert.equal(aggregate.current.sample.state, "partial");
  assert.equal(aggregate.changePct, null);
});
