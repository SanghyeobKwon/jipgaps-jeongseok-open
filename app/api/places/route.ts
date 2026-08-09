export const dynamic = "force-dynamic";

type NaverLocalItem = {
  title?: string;
  link?: string;
  category?: string;
  description?: string;
  roadAddress?: string;
  address?: string;
  mapx?: string;
  mapy?: string;
};

const PLACE_GROUPS = [
  { id: "education", label: "교육", keyword: "학교 학원" },
  { id: "transit", label: "교통", keyword: "지하철역 버스정류장" },
  { id: "health", label: "의료", keyword: "병원 약국" },
  { id: "shopping", label: "장보기", keyword: "마트 시장" },
  { id: "leisure", label: "여가", keyword: "공원 도서관" },
] as const;

function clean(value = "") {
  return value
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function safeText(value: string | null, max = 80) {
  return (value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function searchPlaces(base: string, group: typeof PLACE_GROUPS[number], clientId: string, clientSecret: string) {
  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", `${base} ${group.keyword}`);
  url.searchParams.set("display", "3");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");
  const response = await fetch(url, { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret, Accept: "application/json" } });
  if (!response.ok) throw new Error(`NAVER_LOCAL_${response.status}`);
  const data = await response.json() as { items?: NaverLocalItem[] };
  return {
    id: group.id,
    label: group.label,
    items: (data.items || []).slice(0, 3).map((item) => {
      const title = clean(item.title);
      return {
        title,
        category: clean(item.category),
        description: clean(item.description),
        address: clean(item.roadAddress || item.address),
        mapx: Number(item.mapx) || 0,
        mapy: Number(item.mapy) || 0,
        mapUrl: `https://map.naver.com/p/search/${encodeURIComponent(title)}`,
      };
    }),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = safeText(url.searchParams.get("region"));
  const dong = safeText(url.searchParams.get("dong"), 40);
  const property = safeText(url.searchParams.get("property"));
  if (!region || !property) return Response.json({ error: "지역과 단지를 선택해주세요." }, { status: 400 });

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return Response.json({ error: "네이버 지역검색 API가 아직 연결되지 않았습니다." }, { status: 503 });

  try {
    const base = [...new Set([region, dong, property].filter(Boolean))].join(" ");
    const groups = await Promise.all(PLACE_GROUPS.map((group) => searchPlaces(base, group, clientId, clientSecret)));
    return Response.json({ base, groups, source: "NAVER 지역검색", updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("403") ? "네이버 개발자센터에서 검색 API 권한을 확인해주세요." : "주변 시설을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
