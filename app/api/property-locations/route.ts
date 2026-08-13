import { KakaoLocalError, resolveGeocode } from "../../lib/map/geocoding";
import { deriveMapStatus, statusHttpCode } from "../../lib/map/status";
import type { KakaoFailureKind } from "../../lib/map/kakao-local";
import type { MapScope } from "../../lib/map/types";

export const dynamic = "force-dynamic";
type PropertyRequest = { key?: string; name?: string; dong?: string; jibun?: string; count?: number; lastAmount?: number; propertyType?: string; scope?: Partial<MapScope> };
const PROPERTY_TYPES = new Set(["apt", "rowhouse", "house", "officetel", "commercial", "factory"]);
const clean = (value: unknown, max: number) => String(value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { sido?: string; sigungu?: string; dong?: string; scope?: Partial<MapScope>; properties?: PropertyRequest[] };
    const sido = clean(payload.sido || payload.scope?.sidoName, 30); const sigungu = clean(payload.sigungu || payload.scope?.sigunguName, 40); const selectedDong = clean(payload.dong || payload.scope?.legalDongName, 30);
    if (!sido || !sigungu || !selectedDong) return Response.json({ status: "error", error: "시도, 시군구, 읍면동 선택이 필요합니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 400 });
    const restApiKey = process.env.KAKAO_REST_API_KEY;
    if (!restApiKey) return Response.json({ status: "error", error: "카카오 REST API 키가 설정되지 않았습니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 503 });
    const properties = (Array.isArray(payload.properties) ? payload.properties : []).slice(0, 30);
    const locations: Array<Record<string, unknown>> = []; const failures: KakaoFailureKind[] = []; const rejections: string[] = []; let empty = 0; let rejected = 0;
    for (let index = 0; index < properties.length; index += 5) {
      const batch = await Promise.all(properties.slice(index, index + 5).map(async (property) => {
        const key = clean(property.key, 220); const name = clean(property.name, 100); const dong = clean(property.dong || selectedDong, 30); const jibun = clean(property.jibun, 50);
        if (!key || !name) return { empty: true } as const;
        const scope: Partial<MapScope> = { ...payload.scope, ...property.scope, sidoName: sido, sigunguName: sigungu, legalDongName: dong };
        try {
          const result = await resolveGeocode(`${sido} ${sigungu} ${dong} ${jibun || name}`, scope, new URL(request.url).origin, restApiKey);
          rejected += result.rejected; rejections.push(...result.rejectionReasons);
          if (!result.address) return { empty: true } as const;
          return { value: { key, name, dong, jibun, count: Math.max(0, Number(property.count) || 0), lastAmount: Math.max(0, Number(property.lastAmount) || 0), propertyType: PROPERTY_TYPES.has(String(property.propertyType)) ? String(property.propertyType) : "apt", lng: Number(result.address.x), lat: Number(result.address.y), roadAddress: result.address.roadAddress, jibunAddress: result.address.jibunAddress, codes: result.address.codes, validation: "verified" } } as const;
        } catch (error) { failures.push(error instanceof KakaoLocalError ? error.kind : "upstream"); return { empty: false } as const; }
      }));
      batch.forEach((entry) => { if ("value" in entry) locations.push(entry.value); else if (entry.empty) empty += 1; });
    }
    const status = deriveMapStatus(locations.length, empty + rejected, failures);
    return Response.json({ status, locations, requested: properties.length, matched: locations.length, rejected, rejectionReasons: [...new Set(rejections)], failures: failures.length, source: "국토교통부 실거래가 + Kakao verified coordinates", mapFallback: { markerAllowed: locations.length > 0, reason: locations.length ? "verified_coordinate" : failures.length ? "upstream_failure" : "no_verified_coordinate" } }, { status: statusHttpCode(status, failures), headers: { "Cache-Control": status === "success" || status === "partial" ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store" } });
  } catch {
    return Response.json({ status: "error", error: "건물 위치 요청을 처리하지 못했습니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 502 });
  }
}
