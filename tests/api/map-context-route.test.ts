import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("지도 이동 영역은 카카오 공식 행정·법정동 코드로 전환한다", async () => {
  const source = await readFile(new URL("../../app/api/map-context/route.ts", import.meta.url), "utf8");
  assert.match(source, /reverseRegionCode\(lat, lng, restApiKey\)/);
  assert.match(source, /selectRegionDocuments/);
  assert.match(source, /sigungu: \{ code: code\.slice\(0, 5\)/);
  assert.match(source, /legalDong:/);
});
