import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/common.css";
import "./styles/responsive-web.css";
import "./styles/responsive-tablet.css";
import "./styles/responsive-mobile.css";
import "./styles/research-analysis.css";

const themeBootstrap = `(() => {
  try {
    const preference = localStorage.getItem("jipgaps:theme") || "system";
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePreference = preference;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
  }
})();`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "jipgaps-jeongseok.sueb4509.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "집값의 정석 | 전국 부동산 실거래와 생활권 분석";
  const description = "전국 실거래를 분기 단위로 비교하고 지역·단지·평형별 가격과 주변 생활권을 함께 확인하는 부동산 분석 서비스입니다.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", url: origin, images: [{ url: `${origin}/og-v2.png`, width: 1200, height: 630, alt: "집값의 정석 · 데이터로 보고, 매수 판단은 더 선명하게" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-v2.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{children}</body></html>;
}
