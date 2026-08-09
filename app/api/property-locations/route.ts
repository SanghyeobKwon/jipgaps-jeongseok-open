import { fetchGeocode } from "../geocode/route";

export const dynamic = "force-dynamic";

type PropertyRequest = {
  key?: string;
  name?: string;
  dong?: string;
  jibun?: string;
  count?: number;
  lastAmount?: number;
  propertyType?: string;
};

const PROPERTY_TYPES = new Set(["apt", "rowhouse", "house", "officetel", "commercial", "factory"]);

function clean(value: unknown, maxLength: number) {
  return String(value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      sido?: string;
      sigungu?: string;
      dong?: string;
      properties?: PropertyRequest[];
    };
    const sido = clean(payload.sido, 30);
    const sigungu = clean(payload.sigungu, 40);
    const selectedDong = clean(payload.dong, 30);
    if (!sido || !sigungu || !selectedDong) {
      return Response.json({ error: "시·도, 시·군·구, 읍·면·동 선택이 필요합니다." }, { status: 400 });
    }

    const properties = (Array.isArray(payload.properties) ? payload.properties : []).slice(0, 30);
    const locations: Array<Record<string, unknown>> = [];
    for (let index = 0; index < properties.length; index += 5) {
      const batch = properties.slice(index, index + 5);
      const settled = await Promise.allSettled(batch.map(async (property) => {
        const key = clean(property.key, 220);
        const name = clean(property.name, 100);
        const dong = clean(property.dong || selectedDong, 30);
        const jibun = clean(property.jibun, 50);
        if (!key || !name) return null;
        const query = `${sido} ${sigungu} ${dong} ${jibun || name}`.replace(/\s+/g, " ").trim();
        const address = await fetchGeocode(query, [sido, sigungu, dong]);
        if (!address?.x || !address?.y) return null;
        return {
          key,
          name,
          dong,
          jibun,
          count: Math.max(0, Number(property.count) || 0),
          lastAmount: Math.max(0, Number(property.lastAmount) || 0),
          propertyType: PROPERTY_TYPES.has(String(property.propertyType)) ? String(property.propertyType) : "apt",
          lng: Number(address.x),
          lat: Number(address.y),
          roadAddress: address.roadAddress || "",
          jibunAddress: address.jibunAddress || "",
        };
      }));
      settled.forEach((result) => {
        if (result.status === "fulfilled" && result.value) locations.push(result.value);
      });
    }

    return Response.json(
      { locations, requested: properties.length, matched: locations.length, source: "국토교통부 실거래 + NAVER Maps Geocoding" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "NAVER_MAP_NOT_CONFIGURED"
      ? "네이버 지도 API가 아직 연결되지 않았습니다."
      : "선택한 동의 건물 위치를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: code === "NAVER_MAP_NOT_CONFIGURED" ? 503 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
