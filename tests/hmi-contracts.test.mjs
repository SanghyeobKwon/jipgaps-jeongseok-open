import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { joinClassNames } from "../app/components/common/utils.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const commonCss = read("../app/styles/common.css");
const tokensCss = read("../app/styles/tokens.css");

test("공통 클래스 결합기는 비어 있는 값을 제외한다", () => {
  assert.equal(joinClassNames("hmi-button", false, undefined, "is-active"), "hmi-button is-active");
});

test("모든 공통 조작 요소가 44px 터치 토큰을 공유한다", () => {
  assert.match(tokensCss, /--hmi-touch-min:\s*2\.75rem/);
  for (const className of ["hmi-button", "hmi-chip", "hmi-tab", "hmi-field__control", "hmi-drawer__close", "hmi-async-state__retry"]) {
    assert.match(commonCss, new RegExp(`\\.${className}`));
  }
  assert.match(commonCss, /min-height:\s*var\(--hmi-touch-min\)/);
});

test("키보드 포커스와 모션 감소 계약이 CSS에 존재한다", () => {
  assert.match(commonCss, /:focus-visible/);
  assert.match(commonCss, /outline:\s*3px solid var\(--hmi-focus\)/);
  assert.match(commonCss, /prefers-reduced-motion:\s*reduce/);
});

test("Surface는 plain, section, inset만 공개한다", () => {
  const surfaceSource = read("../app/components/common/Surface.tsx");
  assert.match(surfaceSource, /"plain"\s*\|\s*"section"\s*\|\s*"inset"/);
  assert.doesNotMatch(surfaceSource, /card/i);
});

test("Drawer와 비동기 상태가 필수 접근성 계약을 선언한다", () => {
  const drawerSource = read("../app/components/common/Drawer.tsx");
  const asyncSource = read("../app/components/common/AsyncState.tsx");
  assert.match(drawerSource, /aria-modal="true"/);
  assert.match(drawerSource, /event\.key === "Escape"/);
  assert.match(drawerSource, /restoreFocusRef\.current\?\.focus/);
  assert.match(asyncSource, /"loading" \| "empty" \| "error" \| "partial" \| "low-sample"/);
  assert.match(asyncSource, /aria-live=/);
  assert.match(asyncSource, /onRetry/);
});
