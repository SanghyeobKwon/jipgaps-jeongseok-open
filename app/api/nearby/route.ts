export const dynamic = "force-dynamic";

type KakaoLocalItem = { id?: string; place_name?: string; category_name?: string; address_name?: string; road_address_name?: string; x?: string; y?: string; distance?: string };
type NearbyPlace = { id: string; name: string; category: string; subCategory: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };

const SEARCH_GROUPS = [
  { category: "교통", targets: [{ subCategory: "지하철역", keyword: "지하철역" }, { subCategory: "기차역", keyword: "기차역" }, { subCategory: "버스터미널", keyword: "버스터미널" }] },
  { category: "교육", targets: [{ subCategory: "어린이집", keyword: "어린이집" }, { subCategory: "유치원", keyword: "유치원" }, { subCategory: "초등학교", keyword: "초등학교" }, { subCategory: "중학교", keyword: "중학교" }, { subCategory: "고등학교", keyword: "고등학교" }] },
  { category: "의료", targets: [{ subCategory: "종합병원", keyword: "종합병원" }, { subCategory: "병·의원", keyword: "병원" }, { subCategory: "약국", keyword: "약국" }, { subCategory: "치과", keyword: "치과" }] },
  { category: "장보기", targets: [{ subCategory: "대형마트", keyword: "대형마트" }, { subCategory: "슈퍼마켓", keyword: "슈퍼마켓" }, { subCategory: "편의점", keyword: "편의점" }, { subCategory: "전통시장", keyword: "전통시장" }] },
  { category: "문화·여가", targets: [{ subCategory: "영화관", keyword: "영화관" }, { subCategory: "공연장", keyword: "공연장" }, { subCategory: "공원", keyword: "공원" }, { subCategory: "도서관", keyword: "도서관" }, { subCategory: "박물관", keyword: "박물관" }] },
  { category: "운동", targets: [{ subCategory: "헬스장", keyword: "헬스장" }, { subCategory: "수영장", keyword: "수영장" }, { subCategory: "체육관", keyword: "체육관" }] },
  { category: "생활", targets: [{ subCategory: "은행", keyword: "은행" }, { subCategory: "우체국", keyword: "우체국" }, { subCategory: "주민센터", keyword: "주민센터" }, { subCategory: "세탁소", keyword: "세탁소" }] },
] as const;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000; const rad = Math.PI / 180; const dLat = (lat2 - lat1) * rad; const dLng = (lng2 - lng1) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function searchLocal(lat: number, lng: number, category: string, subCategory: string, keyword: string, restApiKey: string) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", keyword); url.searchParams.set("x", String(lng)); url.searchParams.set("y", String(lat)); url.searchParams.set("radius", "1000"); url.searchParams.set("sort", "distance"); url.searchParams.set("size", "15");
  const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `KakaoAK ${restApiKey}` }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`KAKAO_LOCAL_${response.status}`);
  const data = await response.json() as { documents?: KakaoLocalItem[] };
  return (data.documents || []).map((item) => ({ ...item, group: category, subGroup: subCategory }));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; const lat = Number(params.get("lat")); const lng = Number(params.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 40 || lng < 123 || lng > 133) return Response.json({ error: "대한민국 안의 올바른 좌표가 필요합니다." }, { status: 400 });
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) return Response.json({ error: "카카오 REST API 키가 설정되지 않았습니다." }, { status: 503 });
  try {
    const tasks = SEARCH_GROUPS.flatMap((group) => group.targets.map((target) => searchLocal(lat, lng, group.category, target.subCategory, target.keyword, restApiKey)));
    const results = (await Promise.allSettled(tasks)).flatMap((result) => result.status === "fulfilled" ? result.value : []); const seen = new Set<string>();
    const places: NearbyPlace[] = results.flatMap((item) => {
      const placeLat = Number(item.y); const placeLng = Number(item.x); const name = (item.place_name || "").trim(); if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return [];
      const measuredDistance = Number(item.distance); const distance = Math.round(Number.isFinite(measuredDistance) && measuredDistance >= 0 ? measuredDistance : haversine(lat, lng, placeLat, placeLng)); const key = item.id || `${name}|${placeLat.toFixed(5)}|${placeLng.toFixed(5)}`; if (distance > 1000 || seen.has(key)) return []; seen.add(key);
      return [{ id: key, name, category: item.group, subCategory: item.subGroup, distance, walkingMinutes: Math.max(1, Math.round(distance * 1.2 / 75)), lat: placeLat, lng: placeLng, detail: item.category_name || item.road_address_name || item.address_name || "" }];
    }).sort((a, b) => a.distance - b.distance);
    const categoryCounts = SEARCH_GROUPS.map((group) => ({ category: group.category, within500m: places.filter((place) => place.category === group.category && place.distance <= 500).length, within1km: places.filter((place) => place.category === group.category).length }));
    return Response.json({ places, counts: { within500m: places.filter((place) => place.distance <= 500).length, within1km: places.length, categories: categoryCounts }, radius: 1000, taxonomyVersion: 2, source: "Kakao Local keyword search", measuredAt: new Date().toISOString(), coverageNote: "시설별 검색 결과를 세부 유형으로 나누고 카카오가 제공한 중심점 거리로 재분류한 집계입니다." }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = /KAKAO_LOCAL_(401|403|429)/.test(code) ? "카카오 로컬 API 권한과 REST API 키를 확인해주세요." : "주변 시설 데이터를 잠시 불러오지 못했습니다. 잠시 후 다시 확인해주세요.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
