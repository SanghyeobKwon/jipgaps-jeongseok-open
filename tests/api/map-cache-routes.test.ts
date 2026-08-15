import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("주변 시설 Route는 Supabase 7일 캐시와 외부 동시성 5개 계약을 사용한다", async () => {
  const nearby = await source("app/api/nearby/route.ts");
  assert.match(nearby, /readCache\("nearby-snapshot"/);
  assert.match(nearby, /freshForSeconds: 7 \* 24 \* 60 \* 60/);
  assert.match(nearby, /settleInBatches\(tasks, 5\)/);
  assert.match(nearby, /cached\.state === "stale"/);
});

test("건물 위치 Route는 검증 좌표만 90일 캐시하고 현재 가격 정보를 합성한다", async () => {
  const locations = await source("app/api/property-locations/route.ts");
  assert.match(locations, /readCache<VerifiedGeocode>\("property-geocode"/);
  assert.match(locations, /readCache<PropertyLocationBundle>\("property-geocode-bundle"/);
  assert.match(locations, /freshForSeconds: 90 \* 24 \* 60 \* 60/);
  assert.match(locations, /slice\(0, 30\)/);
  assert.match(locations, /index \+= 10/);
  assert.match(locations, /`\$\{sido\} \$\{sigungu\} \$\{dong\} \$\{name\}`/);
  assert.match(locations, /validation: "verified"/);
  assert.match(locations, /lastAmount: Math\.max\(0, Number\(entry\.property\.lastAmount\)/);
});

test("행정경계 지도는 모든 지역에서 선택 중심 확대와 전체 보기를 제공한다", async () => {
  const page = await source("app/page.tsx");
  const css = await source("app/styles/map-stability.css");
  assert.match(page, /administrativeViewBox/);
  assert.match(page, /aria-label="지도 전체 보기"/);
  assert.match(page, /aria-label="선택 지역 중심으로 지도 확대"/);
  assert.match(css, /\.administrative-map-zoom/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.administrative-map-zoom \{[\s\S]*?top:\s*112px;[\s\S]*?bottom:\s*auto;/);
});
