import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET as getOverview } from "../../app/api/overview/route.ts";
import { GET as getTrades } from "../../app/api/trades/route.ts";

const fixture = (name: string) => readFile(new URL(`../market/fixtures/${name}`, import.meta.url), "utf8");

async function withEnvironment(fetchImpl: typeof fetch, run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalMolit = process.env.MOLIT_SERVICE_KEY;
  const originalReb = process.env.REB_API_KEY;
  globalThis.fetch = fetchImpl;
  process.env.MOLIT_SERVICE_KEY = "test-key";
  process.env.REB_API_KEY = "reb-must-not-be-used";
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (originalMolit === undefined) delete process.env.MOLIT_SERVICE_KEY; else process.env.MOLIT_SERVICE_KEY = originalMolit;
    if (originalReb === undefined) delete process.env.REB_API_KEY; else process.env.REB_API_KEY = originalReb;
  }
}

test("거래 API는 전체 페이지를 수집하고 취소거래와 면적 kind를 분리한다", async () => {
  const [first, second] = await Promise.all([fixture("page-1.xml"), fixture("page-2.xml")]);
  const calls: string[] = [];
  await withEnvironment((async (input) => {
    const url = new URL(String(input));
    calls.push(`${url.searchParams.get("DEAL_YMD")}:${url.searchParams.get("pageNo")}`);
    return new Response(url.searchParams.get("pageNo") === "1" ? first : second);
  }) as typeof fetch, async () => {
    const response = await getTrades(new Request("https://example.test/api/trades?type=apt&lawd=11680&months=3"));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.equal(payload.trades.length, 6);
    assert.ok(payload.trades.every((trade: { cancelled: boolean }) => !trade.cancelled));
    assert.ok(payload.trades.every((trade: { areaMeasurement: { kind: string } }) => trade.areaMeasurement.kind === "exclusive"));
    assert.equal(payload.meta.fetchedPages, 6);
    // The fixture date is intentionally outside the dynamically requested three-month window.
    assert.equal(payload.research.status, "empty");
    assert.equal(Object.keys(payload.research.views).length, 6);
    assert.ok(payload.research.rows.every((row: { areaKind: string }) => row.areaKind === "exclusive"));
    assert.equal(payload.meta.warnings.filter((warning: string) => warning.includes("취소 신고")).length, 1);
    assert.equal(calls.length, 6);
  });
});

test("후속 페이지 실패는 성공 응답의 partial 상태와 경고로 전달한다", async () => {
  const first = await fixture("page-1.xml");
  await withEnvironment((async (input) => {
    const page = new URL(String(input)).searchParams.get("pageNo");
    return page === "1" ? new Response(first) : new Response("upstream failure", { status: 503 });
  }) as typeof fetch, async () => {
    const response = await getTrades(new Request("https://example.test/api/trades?type=apt&lawd=11680&months=3"));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.status, "partial");
    assert.equal(payload.trades.length, 3);
    assert.ok(payload.meta.warnings.some((warning: string) => warning.includes("2페이지")));
    assert.ok(payload.aggregates.monthly.some((point: { sample: { state: string } }) => point.sample.state === "partial"));
  });
});

test("MOLIT 키가 없으면 REB 키로 대체하지 않는다", async () => {
  const originalMolit = process.env.MOLIT_SERVICE_KEY;
  const originalReb = process.env.REB_API_KEY;
  delete process.env.MOLIT_SERVICE_KEY;
  process.env.REB_API_KEY = "reb-only";
  try {
    const response = await getTrades(new Request("https://example.test/api/trades?type=apt&lawd=11680&months=3"));
    const payload = await response.json();
    assert.equal(response.status, 502);
    assert.match(payload.error, /국토교통부 API 키/);
  } finally {
    if (originalMolit === undefined) delete process.env.MOLIT_SERVICE_KEY; else process.env.MOLIT_SERVICE_KEY = originalMolit;
    if (originalReb === undefined) delete process.env.REB_API_KEY; else process.env.REB_API_KEY = originalReb;
  }
});

test("대표 권역 응답은 전국 집계가 아님을 메타에 명시한다", async () => {
  const single = await fixture("single.xml");
  await withEnvironment((async () => new Response(single)) as typeof fetch, async () => {
    const response = await getOverview(new Request("https://example.test/api/overview?type=apt"));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.markets.length, 16);
    assert.equal(payload.meta.scope.kind, "representative-districts");
    assert.equal(payload.meta.scope.nationwide, false);
    assert.equal(payload.meta.scope.label, "16개 대표 시군구 표본");
    assert.ok(payload.markets.every((market: { changePct: number | null }) => market.changePct !== null));
  });
});
