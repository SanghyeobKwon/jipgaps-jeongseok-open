import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const readmeUrl = new URL("../README.md", import.meta.url);

test("로컬 개발 서버는 카카오 SDK 허용 주소인 3010 포트를 사용한다", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  const readme = await readFile(readmeUrl, "utf8");

  assert.match(packageJson.scripts.dev, /(?:--port|--port=)\s*3010|--port=3010/);
  assert.match(readme, /http:\/\/localhost:3010/);
});
