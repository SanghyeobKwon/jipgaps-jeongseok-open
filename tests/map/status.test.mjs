import test from "node:test";
import assert from "node:assert/strict";
import { deriveMapStatus, statusHttpCode } from "../../app/lib/map/status.ts";

test("distinguishes all public API states", () => {
  assert.equal(deriveMapStatus(2, 0, []), "success");
  assert.equal(deriveMapStatus(1, 0, ["timeout"]), "partial");
  assert.equal(deriveMapStatus(0, 1, ["timeout"]), "partial");
  assert.equal(deriveMapStatus(0, 1, []), "empty");
  assert.equal(deriveMapStatus(0, 0, ["quota", "quota"]), "quota");
  assert.equal(deriveMapStatus(0, 0, ["authentication"]), "error");
  assert.equal(statusHttpCode("quota"), 429);
  assert.equal(statusHttpCode("error", ["timeout"]), 504);
});
