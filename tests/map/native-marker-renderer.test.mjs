import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");

test("건물 지도는 일반 매물을 카카오 기본 마커와 클러스터로 렌더링한다", () => {
  assert.match(pageSource, /libraries=clusterer/);
  assert.match(pageSource, /new maps\.Marker\(/);
  assert.match(pageSource, /new maps\.MarkerClusterer\(/);
  assert.match(pageSource, /minLevel: 7/);
});

test("상세 HTML 오버레이는 선택된 건물 하나에만 사용한다", () => {
  const marketMapSource = pageSource.slice(pageSource.indexOf("function KakaoMarketMap"), pageSource.indexOf("export default function Home"));
  assert.equal((marketMapSource.match(/new maps\.CustomOverlay/g) || []).length, 1);
  assert.match(marketMapSource, /selectedDetailOverlay\?\.setMap\(null\)/);
});

test("지도 이동은 마커 DOM을 일괄 분리하지 않는다", () => {
  const marketMapSource = pageSource.slice(pageSource.indexOf("function KakaoMarketMap"), pageSource.indexOf("export default function Home"));
  assert.doesNotMatch(marketMapSource, /hideMarkersForMovement|markerEntries\.forEach\([^)]*setMap/);
});

test("지역과 마커 데이터 갱신은 카카오 지도 인스턴스를 재생성하지 않는다", () => {
  const marketMapSource = pageSource.slice(pageSource.indexOf("function KakaoMarketMap"), pageSource.indexOf("export default function Home"));
  assert.match(marketMapSource, /\}, \[active, focus\]\);/);
  assert.match(marketMapSource, /\[active, buildingLocations, focus, mapGeneration, visibleMapPriceBands\]/);
});
