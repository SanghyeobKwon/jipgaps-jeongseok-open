import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("리서치 탭은 여섯 분석 목적을 고정한다", () => {
  const source = read("../app/components/analysis/ResearchAnalysisWorkspace.tsx");
  for (const label of ["최근 하락", "최고가", "상승률 상위", "평당가격", "가격 변화", "단지 비교"]) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, /6개 사용 가능/);
});

test("주택 유형은 아이콘, 가격은 다섯 구간, 선택은 별도 상태로 표현한다", () => {
  const source = read("../app/components/analysis/PropertyVisual.tsx");
  const css = read("../app/styles/research-analysis.css");
  assert.match(source, /PROPERTY_META/);
  assert.match(source, /priceBucket/);
  assert.match(source, /selected/);
  for (const bucket of [1, 2, 3, 4, 5]) assert.match(css, new RegExp(`is-bucket-${bucket}`));
  assert.match(css, /analysis-property-icon\.is-selected/);
});

test("차트 높이와 반응형 생활권 작업면 계약을 유지한다", () => {
  const css = read("../app/styles/research-analysis.css");
  assert.match(css, /max-height:\s*25rem/);
  assert.match(css, /max-width:\s*74\.9375rem/);
  assert.match(css, /max-width:\s*47\.5rem/);
  assert.match(css, /min-height:\s*var\(--hmi-touch-min\)/);
});

