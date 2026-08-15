import assert from "node:assert/strict";
import test from "node:test";
import { cacheEnabled, readCache, writeCache } from "../../app/lib/cache/repository.ts";

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalFetch = globalThis.fetch;

function restore() {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  globalThis.fetch = originalFetch;
}

test("missing Supabase configuration bypasses reads and writes", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.equal(cacheEnabled(), false);
    assert.deepEqual((await readCache("trades.month", "apt:11680:202608")).state, "unavailable");
    assert.deepEqual((await writeCache("trades.month", "apt:11680:202608", { rows: [] }, { freshForSeconds: 60, staleForSeconds: 60 })).state, "unavailable");
  } finally { restore(); }
});

test("readCache distinguishes fresh and stale entries", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-test-key";
  const now = Date.now();
  let responseRow = {
    namespace: "trades.month", cache_key: "apt:11680:202608", payload: { rows: [1] }, data_status: "ok",
    captured_at: new Date(now - 1_000).toISOString(), fresh_until: new Date(now + 60_000).toISOString(),
    stale_until: new Date(now + 120_000).toISOString(), size_bytes: 12,
  };
  globalThis.fetch = async () => Response.json([responseRow]);
  try {
    assert.equal((await readCache<{ rows: number[] }>("trades.month", "apt:11680:202608")).state, "fresh");
    responseRow = { ...responseRow, fresh_until: new Date(now - 1_000).toISOString() };
    assert.equal((await readCache("trades.month", "apt:11680:202608")).state, "stale");
    assert.equal((await readCache("trades.month", "apt:11680:202608", { allowStale: false })).state, "miss");
  } finally { restore(); }
});

test("writeCache upserts without placing the service key in URL or payload", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-test-key";
  let requestUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body ?? "");
    return new Response(null, { status: 201 });
  };
  try {
    const result = await writeCache("nearby.v2", { property: "sample", radius: 1000 }, { places: [] }, {
      freshForSeconds: 86_400,
      staleForSeconds: 604_800,
      dataStatus: "empty",
      capturedAt: "2026-08-15T00:00:00.000Z",
    });
    assert.equal(result.state, "written");
    assert.equal(requestUrl.includes("server-test-key"), false);
    assert.equal(requestBody.includes("server-test-key"), false);
    assert.match(requestUrl, /on_conflict=namespace%2Ccache_key/);
  } finally { restore(); }
});

test("PostgREST failures return a bypassable cache error", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-test-key";
  globalThis.fetch = async () => new Response("not available", { status: 503 });
  try {
    const result = await readCache("trades.month", "apt:11680:202608");
    assert.equal(result.state, "error");
    assert.equal(result.bypass, true);
    assert.equal(result.data, null);
  } finally { restore(); }
});

test("oversized entries bypass Supabase writes", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-test-key";
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response(null, { status: 201 }); };
  try {
    const result = await writeCache("trades.response", "large", "a".repeat(5 * 1024 * 1024 + 1), {
      freshForSeconds: 60,
      staleForSeconds: 60,
    });
    assert.equal(result.state, "error");
    assert.equal(result.bypass, true);
    assert.equal(called, false);
  } finally { restore(); }
});
