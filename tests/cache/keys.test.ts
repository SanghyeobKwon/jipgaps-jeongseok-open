import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCacheKey, normalizeCacheNamespace } from "../../app/lib/cache/keys.ts";

test("cache key is stable regardless of object property order", () => {
  assert.equal(
    normalizeCacheKey({ lawd: "11680", type: "apt", months: ["2026-07", "2026-08"] }),
    normalizeCacheKey({ months: ["2026-07", "2026-08"], type: "apt", lawd: "11680" }),
  );
});

test("long cache keys are reduced to a bounded sha256 key", () => {
  const key = normalizeCacheKey("가".repeat(300));
  assert.match(key, /^sha256:[a-f0-9]{64}$/);
});

test("cache namespace rejects unsafe values", () => {
  assert.equal(normalizeCacheNamespace(" trades.month "), "trades.month");
  assert.throws(() => normalizeCacheNamespace("Trades/../../secret"));
});
