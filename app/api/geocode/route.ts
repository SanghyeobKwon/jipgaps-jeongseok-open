import { KakaoLocalError, resolveGeocode } from "../../lib/map/geocoding";
import type { MapScope } from "../../lib/map/types";

export const dynamic = "force-dynamic";

function safe(value: string | null, max = 160) {
  return (value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function scopeFromParams(params: URLSearchParams): Partial<MapScope> {
  return {
    sidoCode: safe(params.get("sidoCode"), 2), sidoName: safe(params.get("sido"), 30),
    sigunguCode: safe(params.get("sigunguCode"), 5), sigunguName: safe(params.get("sigungu"), 40),
    adminDongCode: safe(params.get("hCode"), 10), adminDongName: safe(params.get("adminDong"), 30),
    legalDongCode: safe(params.get("bCode"), 10), legalDongName: safe(params.get("legalDong") || params.get("dong"), 30),
    boundaryAdminCode: safe(params.get("boundaryCode"), 10),
  };
}

export async function fetchGeocode(query: string, scope: Partial<MapScope> | string[] = {}, origin = "http://localhost") {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) throw new Error("KAKAO_MAP_NOT_CONFIGURED");
  const normalizedScope = Array.isArray(scope)
    ? { sidoName: scope[0], sigunguName: scope[1], legalDongName: scope[2] }
    : scope;
  return resolveGeocode(query, normalizedScope, origin, restApiKey);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = safe(url.searchParams.get("query"));
  if (!query) return Response.json({ status: "error", error: "주소 검색어가 필요합니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 400 });
  try {
    const result = await fetchGeocode(query, scopeFromParams(url.searchParams), url.origin);
    if (!result.address) return Response.json({ status: "empty", error: "선택 지역 안에서 검증된 건물 좌표를 찾지 못했습니다.", rejected: result.rejected, rejectionReasons: [...new Set(result.rejectionReasons)], mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 404 });
    return Response.json({
      status: result.rejected ? "partial" : "success", lng: Number(result.address.x), lat: Number(result.address.y),
      roadAddress: result.address.roadAddress, jibunAddress: result.address.jibunAddress,
      codes: result.address.codes, validation: "verified", rejected: result.rejected,
      source: "Kakao Local Geocoding + coord2regioncode + SGIS boundary",
      mapFallback: { markerAllowed: true, reason: "verified_coordinate" },
    }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    const missing = error instanceof Error && error.message === "KAKAO_MAP_NOT_CONFIGURED";
    const kind = error instanceof KakaoLocalError ? error.kind : "upstream";
    const status = missing ? 503 : kind === "quota" ? 429 : kind === "timeout" ? 504 : 502;
    return Response.json({ status: kind === "quota" ? "quota" : "error", error: missing ? "카카오 REST API 키가 설정되지 않았습니다." : "좌표 검증 서비스에 연결하지 못했습니다.", failureKind: missing ? "authentication" : kind, rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
