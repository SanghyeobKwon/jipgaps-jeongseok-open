import { readCache, writeCache, type CacheReadResult } from "../../lib/cache/repository";
import { KakaoLocalError, searchKakaoLocal, type KakaoFailureKind, type KakaoLocalDocument } from "../../lib/map/kakao-local";
import { validateCoordinate, isKoreanWgs84 } from "../../lib/map/geocoding";
import { deriveMapStatus, statusHttpCode } from "../../lib/map/status";
import type { MapDataStatus, MapScope } from "../../lib/map/types";

export const dynamic = "force-dynamic";
type NearbyPlace = { id: string; name: string; category: string; subCategory: string; distance: number; walkingMinutes: number; lat: number; lng: number; detail: string };
type NearbyPayload = { status: MapDataStatus; places: NearbyPlace[]; measuredAt?: string; [key: string]: unknown };
const SEARCH_GROUPS = [
  { category: "교통", targets: [["지하철역", "지하철역"], ["기차역", "기차역"], ["버스정류장", "버스정류장"]] },
  { category: "교육", targets: [["어린이집", "어린이집"], ["유치원", "유치원"], ["초등학교", "초등학교"], ["중학교", "중학교"], ["고등학교", "고등학교"]] },
  { category: "의료", targets: [["종합병원", "종합병원"], ["병의원", "병원"], ["약국", "약국"], ["치과", "치과"]] },
  { category: "장보기", targets: [["대형마트", "대형마트"], ["슈퍼마켓", "슈퍼마켓"], ["편의점", "편의점"], ["전통시장", "전통시장"]] },
  { category: "문화·여가", targets: [["영화관", "영화관"], ["공연장", "공연장"], ["공원", "공원"], ["도서관", "도서관"], ["박물관", "박물관"]] },
  { category: "운동", targets: [["헬스장", "헬스장"], ["수영장", "수영장"], ["체육관", "체육관"]] },
  { category: "생활", targets: [["은행", "은행"], ["세탁소", "세탁소"], ["주민센터", "주민센터"], ["우체국", "우체국"]] },
] as const;

async function settleInBatches<T>(tasks: Array<() => Promise<T>>, concurrency = 5) {
  const settled: PromiseSettledResult<T>[] = [];
  for (let index = 0; index < tasks.length; index += concurrency) {
    settled.push(...await Promise.allSettled(tasks.slice(index, index + concurrency).map((task) => task())));
  }
  return settled;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000; const rad = Math.PI / 180; const dLat = (lat2 - lat1) * rad; const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function clean(value: string | null, max: number) { return (value || "").replace(/[<>]/g, " ").trim().slice(0, max); }
function scopeFromParams(params: URLSearchParams): Partial<MapScope> {
  return { sidoCode: clean(params.get("sidoCode"), 2), sidoName: clean(params.get("sido"), 30), sigunguCode: clean(params.get("sigunguCode"), 5), sigunguName: clean(params.get("sigungu"), 40), adminDongCode: clean(params.get("hCode"), 10), adminDongName: clean(params.get("adminDong"), 30), legalDongCode: clean(params.get("bCode"), 10), legalDongName: clean(params.get("legalDong") || params.get("dong"), 30), boundaryAdminCode: clean(params.get("boundaryCode"), 10) };
}

export async function GET(request: Request) {
  const url = new URL(request.url); const lat = Number(url.searchParams.get("lat")); const lng = Number(url.searchParams.get("lng"));
  if (!isKoreanWgs84(lat, lng)) return Response.json({ status: "error", error: "대한민국 범위의 WGS84 좌표가 필요합니다.", rejected: 1, mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 400 });
  const scope = scopeFromParams(url.searchParams);
  const cacheKey = {
    lat: lat.toFixed(5), lng: lng.toFixed(5), radius: 1000, taxonomyVersion: 2,
    sidoCode: scope.sidoCode || "", sigunguCode: scope.sigunguCode || "",
    adminDongCode: scope.adminDongCode || "", legalDongCode: scope.legalDongCode || "",
  };
  const cached: CacheReadResult<NearbyPayload> = await readCache("nearby-snapshot", cacheKey, { allowStale: true });
  if (cached.state === "fresh" && cached.data) {
    return Response.json({ ...cached.data, cache: { state: "fresh", capturedAt: cached.capturedAt } }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  }
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey && cached.state === "stale" && cached.data) {
    return Response.json({ ...cached.data, status: "partial", warning: `카카오 갱신을 수행하지 못해 ${cached.capturedAt ?? "이전 수집 시점"}의 시설 캐시를 표시합니다.`, cache: { state: "stale", capturedAt: cached.capturedAt, fallback: true } }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  }
  if (!restApiKey) return Response.json({ status: "error", error: "카카오 REST API 키가 설정되지 않았습니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 503 });
  try {
    const center = await validateCoordinate(lat, lng, scope, url.origin, restApiKey);
    if (!center.valid) return Response.json({ status: "empty", error: "선택 지역 안에서 중심 좌표를 검증하지 못했습니다.", rejected: 1, rejectionReasons: center.reasons, mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 422 });
    const tasks = SEARCH_GROUPS.flatMap((group) => group.targets.map(([subCategory, keyword]) => async () => ({ category: group.category, subCategory, documents: (await searchKakaoLocal("keyword", keyword, restApiKey, { lat, lng, radius: 1000 })).documents || [] })));
    const settled = await settleInBatches(tasks, 5); const failures: KakaoFailureKind[] = []; const documents: Array<KakaoLocalDocument & { category: string; subCategory: string }> = [];
    settled.forEach((result) => { if (result.status === "fulfilled") result.value.documents.forEach((item) => documents.push({ ...item, category: result.value.category, subCategory: result.value.subCategory })); else failures.push(result.reason instanceof KakaoLocalError ? result.reason.kind : "upstream"); });
    const seen = new Set<string>(); let rejected = 0;
    const places: NearbyPlace[] = documents.flatMap((item) => {
      const placeLat = Number(item.y); const placeLng = Number(item.x); const name = (item.place_name || "").trim();
      if (!name || !isKoreanWgs84(placeLat, placeLng)) { rejected += 1; return []; }
      const measured = Number(item.distance); const distance = Math.round(Number.isFinite(measured) && measured >= 0 ? measured : haversine(lat, lng, placeLat, placeLng));
      const key = item.id || `${name}|${placeLat.toFixed(5)}|${placeLng.toFixed(5)}`;
      if (distance > 1000) { rejected += 1; return []; } if (seen.has(key)) return []; seen.add(key);
      return [{ id: key, name, category: item.category, subCategory: item.subCategory, distance, walkingMinutes: Math.max(1, Math.round(distance * 1.2 / 75)), lat: placeLat, lng: placeLng, detail: item.category_name || item.road_address_name || item.address_name || "" }];
    }).sort((a, b) => a.distance - b.distance);
    const categoryCounts = SEARCH_GROUPS.map((group) => ({ category: group.category, within500m: places.filter((place) => place.category === group.category && place.distance <= 500).length, within1km: places.filter((place) => place.category === group.category).length }));
    const completed = settled.length - failures.length; const status = deriveMapStatus(places.length, completed && !places.length ? completed : 0, failures);
    const payload: NearbyPayload = { status, places, counts: { within500m: places.filter((place) => place.distance <= 500).length, within1km: places.length, categories: categoryCounts }, radius: 1000, taxonomyVersion: 2, rejected, failures: failures.length, centerValidation: { status: "verified", codes: center.codes }, source: "Kakao Local keyword search", measuredAt: new Date().toISOString(), coverageNote: "시설별 검색 결과를 표준 유형으로 분류한 중심점 거리 집계입니다.", mapFallback: { markerAllowed: true, reason: "verified_coordinate" }, cache: { state: cached.state, capturedAt: null } };
    if (status === "success" || status === "empty") {
      await writeCache("nearby-snapshot", cacheKey, payload, { freshForSeconds: 7 * 24 * 60 * 60, staleForSeconds: 30 * 24 * 60 * 60, dataStatus: status === "empty" ? "empty" : "ok" });
    }
    return Response.json(payload, { status: statusHttpCode(status, failures), headers: { "Cache-Control": status === "success" || status === "partial" || status === "empty" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } });
  } catch (error) {
    if (cached.state === "stale" && cached.data) {
      return Response.json({ ...cached.data, status: "partial", warning: `최신 시설 정보를 갱신하지 못해 ${cached.capturedAt ?? "이전 수집 시점"}의 캐시를 표시합니다.`, cache: { state: "stale", capturedAt: cached.capturedAt, fallback: true } }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
    }
    const kind = error instanceof KakaoLocalError ? error.kind : "upstream"; const status = kind === "quota" ? "quota" : "error";
    return Response.json({ status, error: "주변 시설 또는 중심 좌표를 검증하지 못했습니다.", failureKind: kind, rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: statusHttpCode(status, [kind]), headers: { "Cache-Control": "no-store" } });
  }
}
