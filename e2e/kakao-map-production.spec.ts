import { expect, test } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "http://localhost:3010";
const mapUrl = new URL("/", baseUrl);
mapUrl.searchParams.set("sido", "서울특별시");
mapUrl.searchParams.set("sigungu", "11710");
mapUrl.searchParams.set("boundary", "11240600");
mapUrl.hash = "chart";

test("선택 동의 카카오 건물 지도와 가격 마커가 표시된다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(mapUrl.href, { waitUntil: "domcontentloaded" });
  const map = page.locator(".naver-market-canvas:visible").first();
  const fallback = page.locator(".safe-map-fallback:visible").first();
  await expect(page.locator(".naver-market-canvas:visible, .safe-map-fallback:visible").first()).toBeVisible({ timeout: 60_000 });
  await expect(fallback, "카카오 SDK 오류로 안전 지도에 전환되면 배포를 실패 처리합니다.").toHaveCount(0);
  await expect.poll(() => map.getAttribute("data-marker-renderer"), { timeout: 60_000 }).toBe("native-clusterer");
  await expect.poll(async () => Number(await map.getAttribute("data-visible-markers")), { timeout: 60_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => Boolean(window.kakao?.maps)), { timeout: 15_000 }).toBe(true);
});
