import assert from "node:assert/strict";
import test from "node:test";

import { sameMapCamera, stableMapCameraIntent } from "../../app/hooks/useStableMapCamera.ts";

const camera = { contextKey: "district:11680:11230640", center: { lat: 37.5, lng: 127.04 }, level: 4, changedBy: "user" };

test("same scope, property selection and data refresh preserve the current camera", () => {
  const intent = stableMapCameraIntent({ previousScopeKey: "district:11680:11230640", nextScopeKey: "district:11680:11230640", camera });
  assert.deepEqual(intent, { kind: "preserve", camera });
});

test("only a scope transition requests a boundary fit", () => {
  assert.deepEqual(stableMapCameraIntent({ previousScopeKey: "district:11680:11230640", nextScopeKey: "district:11215:11050530", camera }), { kind: "fit", scopeKey: "district:11215:11050530", reason: "scope-change" });
});

test("a shared URL camera restores into the active scope", () => {
  const restored = { ...camera, contextKey: "url", changedBy: "restore" };
  assert.deepEqual(stableMapCameraIntent({ nextScopeKey: "district:11680:11230640", restoredCamera: restored }), { kind: "restore", camera: { ...restored, contextKey: "district:11680:11230640", changedBy: "restore" } });
});

test("a stale restore camera cannot override a new region scope", () => {
  assert.deepEqual(stableMapCameraIntent({
    previousScopeKey: "district:11680:11230640",
    nextScopeKey: "district:28185:28185630",
    camera,
    restoredCamera: { ...camera, contextKey: "district:11680:11230640", changedBy: "restore" },
  }), { kind: "fit", scopeKey: "district:28185:28185630", reason: "scope-change" });
});

test("camera equality ignores tiny coordinate noise but detects level and scope changes", () => {
  assert.equal(sameMapCamera(camera, { ...camera, center: { lat: camera.center.lat + 0.00000001, lng: camera.center.lng } }), true);
  assert.equal(sameMapCamera(camera, { ...camera, level: 5 }), false);
  assert.equal(sameMapCamera(camera, { ...camera, contextKey: "other" }), false);
});
