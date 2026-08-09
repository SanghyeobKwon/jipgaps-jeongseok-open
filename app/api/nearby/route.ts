export const dynamic = "force-dynamic";

type NaverLocalItem = { title?: string; category?: string; address?: string; roadAddress?: string; mapx?: string; mapy?: string };
type NearbyPlace = { id: string; name: string; category: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };

const SEARCH_GROUPS = [
  { category: "교통", keywords: ["지하철역", "기차역", "버스터미널"] },
  { category: "교육", keywords: ["초등학교", "중학교", "고등학교", "유치원"] },
  { category: "의료", keywords: ["병원", "약국"] },
  { category: "장보기", keywords: ["편의점", "대형마트", "슈퍼마켓"] },
  { category: "여가", keywords: ["공원", "도서관", "헬스장"] },
  { category: "생활", keywords: ["은행", "카페"] },
] as const;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000; const rad = Math.PI / 180; const dLat = (lat2 - lat1) * rad; const dLng = (lng2 - lng1) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function stripHtml(value = "") { return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim(); }

async function searchLocal(area: string, category: string, keyword: string, clientId: string, clientSecret: string) {
  const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/local");
  url.searchParams.set("query", `${area} ${keyword}`.trim()); url.searchParams.set("display", "5"); url.searchParams.set("start", "1"); url.searchParams.set("sort", "random"); url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { Accept: "application/json", "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": clientSecret }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`NAVER_LOCAL_${response.status}`);
  const data = await response.json() as { items?: NaverLocalItem[] };
  return (data.items || []).map((item) => ({ ...item, group: category }));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; const lat = Number(params.get("lat")); const lng = Number(params.get("lng")); const area = (params.get("area") || "").trim().slice(0, 80);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133) return Response.json({ error: "대한민국 안의 올바른 좌표가 필요합니다." }, { status: 400 });
  const clientId = process.env.NAVER_API_HUB_CLIENT_ID; const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return Response.json({ error: "NAVER API HUB 인증 정보가 설정되지 않았습니다." }, { status: 503 });
  try {
    const tasks = SEARCH_GROUPS.flatMap((group) => group.keywords.map((keyword) => searchLocal(area, group.category, keyword, clientId, clientSecret)));
    const results = (await Promise.allSettled(tasks)).flatMap((result) => result.status === "fulfilled" ? result.value : []); const seen = new Set<string>();
    const places: NearbyPlace[] = results.flatMap((item) => {
      const placeLat = Number(item.mapy); const placeLng = Number(item.mapx); const name = stripHtml(item.title); if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return [];
      const distance = Math.round(haversine(lat, lng, placeLat, placeLng)); const key = `${name}|${placeLat.toFixed(5)}|${placeLng.toFixed(5)}`; if (distance > 1000 || seen.has(key)) return []; seen.add(key);
      return [{ id: key, name, category: item.group, distance, walkingMinutes: Math.max(1, Math.round(distance * 1.2 / 75)), lat: placeLat, lng: placeLng, detail: item.category || item.roadAddress || item.address || "" }];
    }).sort((a, b) => a.distance - b.distance);
    const categoryCounts = SEARCH_GROUPS.map((group) => ({ category: group.category, within500m: places.filter((place) => place.category === group.category && place.distance <= 500).length, within1km: places.filter((place) => place.category === group.category).length }));
    return Response.json({ places, counts: { within500m: places.filter((place) => place.distance <= 500).length, within1km: places.length, categories: categoryCounts }, radius: 1000, source: "NAVER API HUB 지역 검색", measuredAt: new Date().toISOString(), coverageNote: "카테고리별 상위 검색 결과를 좌표 거리로 재분류한 집계입니다." }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("401") ? "NAVER API HUB 인증 정보를 확인해주세요." : "주변 시설 데이터를 잠시 불러오지 못했습니다. 잠시 후 다시 확인해주세요.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
