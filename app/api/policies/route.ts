export const dynamic = "force-dynamic";

const POLICY_URL = "https://www.korea.kr/news/policyNewsList.do";
const KEYWORDS = ["주택", "부동산", "아파트", "전세", "월세", "임대", "분양", "청약", "토지거래", "재건축", "재개발"];
const FALLBACK = [
  { date: "2026.07.20", tone: "positive", label: "호재", scope: "비아파트·임대", title: "비아파트 공급 보완조치 전면 시행", summary: "토지 확보 지원금 상향과 PF 보증 강화로 비아파트 공급 사업의 초기 부담이 완화됩니다.", url: "https://www.korea.kr/news/policyNewsView.do?newsId=148968416" },
  { date: "2026.05.12", tone: "neutral", label: "중립", scope: "토지거래허가", title: "세입자 있는 주택 실거주 유예 확대", summary: "임대 중 주택의 매도 편의는 개선되지만 갭투자 제한 원칙은 유지됩니다.", url: "https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95091995" },
] as const;

function clean(value: string) { return value.replace(/<[^>]+>/g, " ").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replace(/\s+/g, " ").trim(); }
function classify(title: string) {
  if (/공급|지원|완화|확대|인하|개선|활성화/.test(title)) return { tone: "positive", label: "호재" };
  if (/인상|규제|제한|단속|축소|중과|강화/.test(title)) return { tone: "negative", label: "악재" };
  return { tone: "neutral", label: "중립" };
}

export async function GET() {
  try {
    const response = await fetch(POLICY_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error("official feed unavailable");
    const html = await response.text(); const seen = new Set<string>(); const policies = [];
    for (const match of html.matchAll(/<a[^>]+href=["']([^"']*policyNewsView\.do[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = clean(match[2]).replace(/\s*단계상승\s*\d+\s*$/, ""); if (title.length < 8 || title.length > 160 || !KEYWORDS.some((keyword) => title.includes(keyword)) || seen.has(title)) continue;
      seen.add(title); const sentiment = classify(title); const nearby = html.slice(Math.max(0, (match.index || 0) - 250), (match.index || 0) + match[0].length + 250); const date = nearby.match(/20\d{2}[./-]\d{2}[./-]\d{2}/)?.[0]?.replaceAll("-", ".").replaceAll("/", ".") || "최신 발표";
      policies.push({ date, ...sentiment, scope: "정부 공식정책", title, summary: "정부 공식 발표입니다. 세부 적용 대상과 시행일은 원문에서 확인하세요.", url: new URL(match[1].replaceAll("&amp;", "&"), POLICY_URL).toString() });
      if (policies.length >= 6) break;
    }
    const merged = [...policies, ...FALLBACK.filter((item) => !seen.has(item.title))].slice(0, 6);
    return Response.json({ policies: merged, source: "대한민국 정책브리핑", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ policies: FALLBACK, source: "국토교통부 공식 발표", updatedAt: new Date().toISOString(), fallback: true }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  }
}
