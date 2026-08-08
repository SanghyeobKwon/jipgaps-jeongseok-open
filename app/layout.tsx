import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "집값의 정석 | 대한민국 아파트 데이터 분석",
  description: "실거래가 차트, 입지 가치 점수, 커뮤니티 관점을 한눈에 확인하는 부동산 분석 서비스",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
