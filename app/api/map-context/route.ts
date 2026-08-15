import { KakaoLocalError, reverseRegionCode } from "../../lib/map/kakao-local";
import { cleanRegionCode, selectRegionDocuments } from "../../lib/map/region-codes";

export const dynamic = "force-dynamic";

function coordinate(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = coordinate(url.searchParams.get("lat"), 32, 40);
  const lng = coordinate(url.searchParams.get("lng"), 123, 133);
  if (lat === null || lng === null) return Response.json({ status: "error", error: "대한민국 지도 중심 좌표가 필요합니다." }, { status: 400 });

  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) return Response.json({ status: "error", error: "카카오 지도 연결 정보가 없습니다." }, { status: 503 });

  try {
    const response = await reverseRegionCode(lat, lng, restApiKey);
    const regions = selectRegionDocuments(response.documents || []);
    const reference = regions.legal || regions.administrative;
    const code = cleanRegionCode(reference?.code);
    if (!reference || code.length < 5) return Response.json({ status: "empty", error: "현재 지도 중심의 행정구역을 확인하지 못했습니다." }, { status: 404 });

    return Response.json({
      status: "success",
      center: { lat, lng },
      sido: { code: code.slice(0, 2), name: reference.region_1depth_name || "" },
      sigungu: { code: code.slice(0, 5), name: reference.region_2depth_name || "" },
      administrativeDong: { code: cleanRegionCode(regions.administrative?.code), name: regions.administrative?.region_3depth_name || "" },
      legalDong: { code: cleanRegionCode(regions.legal?.code), name: regions.legal?.region_3depth_name || "" },
      source: "Kakao coord2regioncode",
    }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    const kind = error instanceof KakaoLocalError ? error.kind : "upstream";
    const status = kind === "quota" ? 429 : kind === "timeout" ? 504 : 502;
    return Response.json({ status: kind === "quota" ? "quota" : "error", error: "현재 지도 영역을 확인하지 못했습니다.", failureKind: kind }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
