import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "jipgaps-jeongseok.sueb4509.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "집값의 정석 PRO | 전국 부동산 실거래 투자 분석";
  const description = "전국 실거래를 분기 단위로 비교하고 동·평형별 가격 매력, 거래량, 가격 흐름을 한눈에 확인하는 부동산 분석 서비스입니다.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", url: origin, images: [{ url: `${origin}/og-v2.png`, width: 1200, height: 630, alt: "집값의 정석 · 데이터로 보고, 매수 판단은 더 선명하게" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og-v2.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
