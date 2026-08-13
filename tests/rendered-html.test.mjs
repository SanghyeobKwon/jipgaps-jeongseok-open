import assert from "node:assert/strict";
import test from "node:test";

async function request(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("집값의 정석 운영 화면을 서버 렌더링한다", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>집값의 정석/);
  assert.match(html, /class="terminal-shell" data-view="home"/);
  assert.match(html, /집값/);
  assert.match(html, /상세 분석/);
  assert.match(html, /지도·리서치/);
  assert.match(html, /커뮤니티/);
  assert.match(html, /정책/);
  assert.match(html, /버전 확인 중/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|react-loading-skeleton/i);
});

test("배포 버전 API는 비밀값 없이 확인 가능한 상태를 반환한다", async () => {
  const response = await request("/api/release");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  const body = await response.json();
  assert.equal(body.commit, "local");
  assert.equal(body.shortCommit, "local");
  assert.equal(body.source, "local");
  assert.deepEqual(Object.keys(body).sort(), ["commit", "shortCommit", "source"]);
});
