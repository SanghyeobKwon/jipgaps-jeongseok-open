import { readCache, writeCache } from "../../lib/cache/repository";
import { KakaoLocalError, resolveGeocode, type VerifiedGeocode } from "../../lib/map/geocoding";
import { statusHttpCode } from "../../lib/map/status";
import type { KakaoFailureKind } from "../../lib/map/kakao-local";
import type { MapDataStatus, MapScope } from "../../lib/map/types";

export const dynamic = "force-dynamic";

type PropertyRequest = { key?: string; name?: string; dong?: string; jibun?: string; count?: number; lastAmount?: number; propertyType?: string; scope?: Partial<MapScope> };
type CachedPropertyLocation = { key: string; address: VerifiedGeocode };
type PropertyLocationBundle = {
  entries: CachedPropertyLocation[];
  complete: boolean;
  rejected: number;
  rejectionReasons: string[];
  failures: number;
};
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
    // A sigungu can contain many nearby legal dongs. Keep enough verified,
    // unique buildings available so panning and zooming reveal the current
    // viewport instead of only the originally selected dong.
    const properties = (Array.isArray(payload.properties) ? payload.properties : []).slice(0, 30);
    const locations: Array<Record<string, unknown>> = [];
    const failures: KakaoFailureKind[] = [];
    const rejections: string[] = [];
    const cacheStates = { fresh: 0, stale: 0, miss: 0, unavailable: 0, error: 0 };
    let empty = 0;
    let rejected = 0;

    const prepared = properties.map((property) => ({
      property,
      key: clean(property.key, 220),
      name: clean(property.name, 100),
      dong: clean(property.dong || selectedDong, 30),
      jibun: clean(property.jibun, 50),
    })).filter((entry) => entry.key && entry.name);
    const bundleKey = { sido, sigungu, selectedDong, properties: prepared.map(({ key, name, dong, jibun }) => ({ key, name, dong, jibun })) };
    const bundleCache = await readCache<PropertyLocationBundle>("property-geocode-bundle", bundleKey, { allowStale: true });
    const bundleIndex = new Map((bundleCache.data?.entries || []).map((entry) => [entry.key, entry.address]));
    const locationValue = (entry: typeof prepared[number], address: VerifiedGeocode) => ({
      key: entry.key,
      name: entry.name,
      dong: entry.dong,
      jibun: entry.jibun,
      count: Math.max(0, Number(entry.property.count) || 0),
      lastAmount: Math.max(0, Number(entry.property.lastAmount) || 0),
      propertyType: PROPERTY_TYPES.has(String(entry.property.propertyType)) ? String(entry.property.propertyType) : "apt",
      lng: Number(address.x),
      lat: Number(address.y),
      roadAddress: address.roadAddress,
      jibunAddress: address.jibunAddress,
      codes: address.codes,
      validation: "verified",
    });
    if (bundleCache.state === "fresh" && prepared.length && bundleCache.data?.entries.length) {
      const bundledLocations = prepared.filter(({ key }) => bundleIndex.has(key)).map((entry) => locationValue(entry, bundleIndex.get(entry.key)!));
      const bundleStatus: MapDataStatus = bundleCache.data.complete && bundledLocations.length === prepared.length ? "success" : "partial";
      return Response.json({ status: bundleStatus, locations: bundledLocations, requested: properties.length, matched: bundledLocations.length, rejected: bundleCache.data.rejected, rejectionReasons: bundleCache.data.rejectionReasons, failures: bundleCache.data.failures, source: "국토교통부 실거래가 + Kakao verified coordinates", cache: { ...cacheStates, bundle: "fresh" }, mapFallback: { markerAllowed: true, reason: "verified_coordinate" } }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
    }

    for (let index = 0; index < prepared.length; index += 10) {
      const batch = await Promise.all(prepared.slice(index, index + 10).map(async (entry) => {
        const { property, key, name, dong, jibun } = entry;
        const scope: Partial<MapScope> = { ...payload.scope, ...property.scope, sidoName: sido, sigunguName: sigungu, legalDongName: dong };
        const addressQuery = `${sido} ${sigungu} ${dong} ${jibun || name}`.replace(/\s+/g, " ").trim();
        const cacheKey = { propertyKey: key, addressQuery, sidoCode: scope.sidoCode || "", sigunguCode: scope.sigunguCode || "", adminDongCode: scope.adminDongCode || "", legalDongCode: scope.legalDongCode || "", boundaryAdminCode: scope.boundaryAdminCode || "" };
        const cached = await readCache<VerifiedGeocode>("property-geocode", cacheKey, { allowStale: true });
        cacheStates[cached.state] += 1;
        if (cached.state === "fresh" && cached.data) return { value: locationValue(entry, cached.data), cachedAddress: cached.data } as const;
        if (!restApiKey) {
          failures.push("authentication");
          return cached.state === "stale" && cached.data ? { value: locationValue(entry, cached.data), cachedAddress: cached.data } as const : { empty: false } as const;
        }
        try {
          const queries = [...new Set([
            addressQuery,
            `${sido} ${sigungu} ${dong} ${name}`,
            `${sido} ${sigungu} ${name}`,
          ].map((query) => query.replace(/\s+/g, " ").trim()))];
          let verifiedAddress: VerifiedGeocode | null = null;
          for (const query of queries) {
            const result = await resolveGeocode(query, scope, new URL(request.url).origin, restApiKey);
            rejected += result.rejected;
            rejections.push(...result.rejectionReasons);
            if (result.address) { verifiedAddress = result.address; break; }
          }
          if (!verifiedAddress) return { empty: true } as const;
          await writeCache("property-geocode", cacheKey, verifiedAddress, { freshForSeconds: 90 * 24 * 60 * 60, staleForSeconds: 180 * 24 * 60 * 60, dataStatus: "ok" });
          return { value: locationValue(entry, verifiedAddress), cachedAddress: verifiedAddress } as const;
        } catch (error) {
          failures.push(error instanceof KakaoLocalError ? error.kind : "upstream");
          return cached.state === "stale" && cached.data ? { value: locationValue(entry, cached.data), cachedAddress: cached.data } as const : { empty: false } as const;
        }
      }));
      batch.forEach((entry) => {
        if ("value" in entry && entry.value) locations.push(entry.value);
        else if ("empty" in entry && entry.empty) empty += 1;
      });
    }

    if (prepared.length && locations.length) {
      const complete = locations.length === prepared.length && !failures.length && !empty && !rejected;
      const entries = locations.map((location) => ({
        key: String(location.key),
        address: {
          x: String(location.lng), y: String(location.lat),
          roadAddress: String(location.roadAddress || ""), jibunAddress: String(location.jibunAddress || ""),
          codes: (location.codes || {}) as VerifiedGeocode["codes"],
        },
      }));
      await writeCache("property-geocode-bundle", bundleKey, { entries, complete, rejected, rejectionReasons: [...new Set(rejections)], failures: failures.length }, {
        freshForSeconds: complete ? 7 * 24 * 60 * 60 : 15 * 60,
        staleForSeconds: complete ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
        dataStatus: complete ? "ok" : "partial",
      });
    }

    if (!restApiKey && !locations.length && failures.length) return Response.json({ status: "error", error: "카카오 REST API 키가 설정되지 않았습니다.", rejected, failures: failures.length, cache: cacheStates, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 503 });
    let status: MapDataStatus;
    if (locations.length) status = failures.length || empty || rejected ? "partial" : "success";
    else if (failures.length && (empty || rejected)) status = "partial";
    else if (failures.length && failures.every((failure) => failure === "quota")) status = "quota";
    else if (failures.length) status = "error";
    else status = "empty";
    return Response.json({ status, locations, requested: properties.length, matched: locations.length, rejected, rejectionReasons: [...new Set(rejections)], failures: failures.length, source: "국토교통부 실거래가 + Kakao verified coordinates", cache: { ...cacheStates, bundle: bundleCache.state }, mapFallback: { markerAllowed: locations.length > 0, reason: locations.length ? "verified_coordinate" : failures.length ? "upstream_failure" : "no_verified_coordinate" } }, { status: statusHttpCode(status, failures), headers: { "Cache-Control": status === "success" || status === "partial" ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store" } });
  } catch {
    return Response.json({ status: "error", error: "건물 위치 요청을 처리하지 못했습니다.", rejected: 0, mapFallback: { markerAllowed: false, reason: "upstream_failure" } }, { status: 502 });
  }
}
