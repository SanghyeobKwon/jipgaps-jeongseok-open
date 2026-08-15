import { readCache, writeCache } from "../../lib/cache/repository";
import { KakaoLocalError, resolveGeocode, type VerifiedGeocode } from "../../lib/map/geocoding";
import { statusHttpCode } from "../../lib/map/status";
import type { KakaoFailureKind } from "../../lib/map/kakao-local";
import type { MapDataStatus, MapScope } from "../../lib/map/types";

export const dynamic = "force-dynamic";

type PropertyRequest = { key?: string; name?: string; dong?: string; jibun?: string; count?: number; lastAmount?: number; propertyType?: string; scope?: Partial<MapScope> };
const PROPERTY_TYPES = new Set(["apt", "rowhouse", "house", "officetel", "commercial", "factory"]);
const clean = (value: unknown, max: number) => String(value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { sido?: string; sigungu?: string; dong?: string; scope?: Partial<MapScope>; properties?: PropertyRequest[] };
    const sido = clean(payload.sido || payload.scope?.sidoName, 30);
    const sigungu = clean(payload.sigungu || payload.scope?.sigunguName, 40);
    const selectedDong = clean(payload.dong || payload.scope?.legalDongName, 30);
    if (!sido || !sigungu || !selectedDong) return Response.json({ status: "error", error: "시도, 시군구, 읍면동 선택이 필요합니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "no_verified_coordinate" } }, { status: 400 });

    const restApiKey = process.env.KAKAO_REST_API_KEY;
    const properties = (Array.isArray(payload.properties) ? payload.properties : []).slice(0, 30);
    const locations: Array<Record<string, unknown>> = [];
    const failures: KakaoFailureKind[] = [];
    const rejections: string[] = [];
    const cacheStates = { fresh: 0, stale: 0, miss: 0, unavailable: 0, error: 0 };
    let empty = 0;
    let rejected = 0;

    for (let index = 0; index < properties.length; index += 5) {
      const batch = await Promise.all(properties.slice(index, index + 5).map(async (property) => {
        const key = clean(property.key, 220);
        const name = clean(property.name, 100);
        const dong = clean(property.dong || selectedDong, 30);
        const jibun = clean(property.jibun, 50);
        if (!key || !name) return { empty: true } as const;
        const scope: Partial<MapScope> = { ...payload.scope, ...property.scope, sidoName: sido, sigunguName: sigungu, legalDongName: dong };
        const addressQuery = `${sido} ${sigungu} ${dong} ${jibun || name}`.replace(/\s+/g, " ").trim();
        const cacheKey = { propertyKey: key, addressQuery, sidoCode: scope.sidoCode || "", sigunguCode: scope.sigunguCode || "", adminDongCode: scope.adminDongCode || "", legalDongCode: scope.legalDongCode || "", boundaryAdminCode: scope.boundaryAdminCode || "" };
        const cached = await readCache<VerifiedGeocode>("property-geocode", cacheKey, { allowStale: true });
        cacheStates[cached.state] += 1;
        const locationValue = (address: VerifiedGeocode) => ({ key, name, dong, jibun, count: Math.max(0, Number(property.count) || 0), lastAmount: Math.max(0, Number(property.lastAmount) || 0), propertyType: PROPERTY_TYPES.has(String(property.propertyType)) ? String(property.propertyType) : "apt", lng: Number(address.x), lat: Number(address.y), roadAddress: address.roadAddress, jibunAddress: address.jibunAddress, codes: address.codes, validation: "verified" });
        if (cached.state === "fresh" && cached.data) return { value: locationValue(cached.data) } as const;
        if (!restApiKey) {
          failures.push("authentication");
          return cached.state === "stale" && cached.data ? { value: locationValue(cached.data) } as const : { empty: false } as const;
        }
        try {
          const result = await resolveGeocode(addressQuery, scope, new URL(request.url).origin, restApiKey);
          rejected += result.rejected;
          rejections.push(...result.rejectionReasons);
          if (!result.address) return { empty: true } as const;
          const verifiedAddress = result.address;
          await writeCache("property-geocode", cacheKey, verifiedAddress, { freshForSeconds: 90 * 24 * 60 * 60, staleForSeconds: 180 * 24 * 60 * 60, dataStatus: "ok" });
          return { value: locationValue(verifiedAddress) } as const;
        } catch (error) {
          failures.push(error instanceof KakaoLocalError ? error.kind : "upstream");
          return cached.state === "stale" && cached.data ? { value: locationValue(cached.data) } as const : { empty: false } as const;
        }
      }));
      batch.forEach((entry) => {
        if ("value" in entry && entry.value) locations.push(entry.value);
        else if ("empty" in entry && entry.empty) empty += 1;
      });
    }

    if (!restApiKey && !locations.length && failures.length) return Response.json({ status: "error", error: "카카오 REST API 키가 설정되지 않았습니다.", rejected, failures: failures.length, cache: cacheStates, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 503 });
    let status: MapDataStatus;
    if (locations.length) status = failures.length || empty || rejected ? "partial" : "success";
    else if (failures.length && (empty || rejected)) status = "partial";
    else if (failures.length && failures.every((failure) => failure === "quota")) status = "quota";
    else if (failures.length) status = "error";
    else status = "empty";
    return Response.json({ status, locations, requested: properties.length, matched: locations.length, rejected, rejectionReasons: [...new Set(rejections)], failures: failures.length, source: "국토교통부 실거래가 + Kakao verified coordinates", cache: cacheStates, mapFallback: { markerAllowed: locations.length > 0, reason: locations.length ? "verified_coordinate" : failures.length ? "upstream_failure" : "no_verified_coordinate" } }, { status: statusHttpCode(status, failures), headers: { "Cache-Control": status === "success" || status === "partial" ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store" } });
  } catch {
    return Response.json({ status: "error", error: "건물 위치 요청을 처리하지 못했습니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 502 });
  }
}
