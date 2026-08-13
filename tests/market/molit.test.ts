import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { fetchAllMolitPages, parseMolitPage, UpstreamDataError } from "../../app/lib/market/molit.ts";
import { normalizeMolitTrade } from "../../app/lib/market/normalize.ts";

const fixture = (name: string) => readFile(new URL(`fixtures/${name}`, import.meta.url), "utf8");

test("HTTP 200 오류 XML과 빈·스키마 오류 응답을 거부한다", async () => {
  const [errorXml, validEmptyXml] = await Promise.all([fixture("error-200.xml"), fixture("empty.xml")]);
  assert.throws(() => parseMolitPage(""), (error: unknown) => error instanceof UpstreamDataError && error.kind === "empty");
  assert.throws(() => parseMolitPage("<html>maintenance</html>"), (error: unknown) => error instanceof UpstreamDataError && error.kind === "schema");
  assert.throws(() => parseMolitPage(errorXml), (error: unknown) => error instanceof UpstreamDataError && error.kind === "upstream");
  assert.deepEqual(parseMolitPage(validEmptyXml).rows, []);
});

test("전체 페이지를 가져오고 후속 페이지 실패는 partial로 표시한다", async () => {
  const [first, second] = await Promise.all([fixture("page-1.xml"), fixture("page-2.xml")]);
  const calls: number[] = [];
  const complete = await fetchAllMolitPages(new URL("https://example.test/trades?numOfRows=2"), {
    fetchImpl: (async (input) => {
      const page = Number(new URL(String(input)).searchParams.get("pageNo"));
      calls.push(page);
      return new Response(page === 1 ? first : second);
    }) as typeof fetch,
  });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(complete.rows.length, 3);
  assert.equal(complete.partial, false);

  const partial = await fetchAllMolitPages(new URL("https://example.test/trades?numOfRows=2"), {
    fetchImpl: (async (input) => new Response(new URL(String(input)).searchParams.get("pageNo") === "1" ? first : "failure", { status: new URL(String(input)).searchParams.get("pageNo") === "1" ? 200 : 503 })) as typeof fetch,
  });
  assert.equal(partial.partial, true);
  assert.equal(partial.fetchedPages, 1);
  assert.equal(partial.warnings.length, 1);
});

test("취소거래를 식별하고 주택 유형별 면적 kind를 보존한다", async () => {
  const page = parseMolitPage(await fixture("page-1.xml"));
  const live = normalizeMolitTrade(page.rows[0], "apt", 0);
  const cancelled = normalizeMolitTrade(page.rows[1], "apt", 1);
  assert.equal(live?.areaMeasurement.kind, "exclusive");
  assert.equal(live?.area, 84.5);
  assert.equal(cancelled?.cancelled, true);

  const house = normalizeMolitTrade({ dealAmount: "50,000", dealYear: "2026", dealMonth: "3", dealDay: "4", totalFloorAr: "120" }, "house", 0);
  const commercial = normalizeMolitTrade({ dealAmount: "70,000", dealYear: "2026", dealMonth: "3", dealDay: "4", buildingAr: "80", plottageAr: "200" }, "commercial", 0);
  assert.equal(house?.areaMeasurement.kind, "grossFloor");
  assert.equal(commercial?.areaMeasurement.kind, "building");
});

test("연결 timeout을 구분된 오류로 반환한다", async () => {
  await assert.rejects(
    fetchAllMolitPages(new URL("https://example.test/trades"), {
      fetchImpl: (async () => { throw new DOMException("timed out", "TimeoutError"); }) as typeof fetch,
      timeoutMs: 1,
    }),
    (error: unknown) => error instanceof UpstreamDataError && error.kind === "timeout",
  );
});
