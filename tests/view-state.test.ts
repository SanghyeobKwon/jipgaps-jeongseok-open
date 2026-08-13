import assert from "node:assert/strict";
import test from "node:test";

import { readViewState, writeViewState } from "../app/lib/navigation/view-state.ts";

test("공유 URL의 지역·건물·면적·카메라 상태를 복원한다", () => {
  const url = new URL("https://example.test/?sido=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&sigungu=11680&hcode=11230580&property=apt%7C123&area=84.9&tradePy=26&lat=37.49&lng=127.06&level=4#research");
  assert.deepEqual(readViewState(url), {
    screen: "research",
    sido: "서울특별시",
    sigungu: "11680",
    hcode: "11230580",
    bcode: undefined,
    property: "apt|123",
    area: "84.9",
    tradePy: "26",
    lat: 37.49,
    lng: 127.06,
    level: 4,
  });
});

test("허용 범위를 벗어난 좌표와 긴 입력은 복원하지 않는다", () => {
  const url = new URL(`https://example.test/?property=${"a".repeat(241)}&lat=0&lng=500&level=99#chart`);
  const state = readViewState(url);
  assert.equal(state.screen, "chart");
  assert.equal(state.property, undefined);
  assert.equal(state.lat, undefined);
  assert.equal(state.lng, undefined);
  assert.equal(state.level, undefined);
});

test("상태를 기록할 때 기존 비상태 파라미터는 보존한다", () => {
  const current = new URL("https://example.test/?v=baseline&analysis=field#chart");
  const next = writeViewState(current, {
    screen: "research",
    sido: "서울특별시",
    sigungu: "11680",
    hcode: "11230580",
    lat: 37.49,
    lng: 127.06,
    level: 4,
  });
  assert.match(next, /^\/\?/);
  assert.match(next, /v=baseline/);
  assert.match(next, /analysis=field/);
  assert.match(next, /sigungu=11680/);
  assert.match(next, /#research$/);
});

test("과거 field/map 해시는 현재 화면으로 정규화한다", () => {
  assert.equal(readViewState(new URL("https://example.test/#field")).screen, "chart");
  assert.equal(readViewState(new URL("https://example.test/#map")).screen, "research");
});
