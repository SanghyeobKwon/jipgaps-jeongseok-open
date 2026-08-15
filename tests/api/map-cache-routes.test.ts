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
  assert.match(locations, /freshForSeconds: 90 \* 24 \* 60 \* 60/);
  assert.match(locations, /validation: "verified"/);
  assert.match(locations, /lastAmount: Math\.max\(0, Number\(property\.lastAmount\)/);
});
