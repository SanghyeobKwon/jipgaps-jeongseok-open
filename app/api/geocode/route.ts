export const dynamic = "force-dynamic";

type GeocodeAddress = { roadAddress?: string; jibunAddress?: string; x?: string; y?: string; distance?: number };

function safeQuery(value: string | null) {
  return (value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function GET(request: Request) {
  const query = safeQuery(new URL(request.url).searchParams.get("query"));
  if (!query) return Response.json({ error: "주소 검색어가 필요합니다." }, { status: 400 });

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) return Response.json({ error: "네이버 지도 API가 아직 연결되지 않았습니다." }, { status: 503 });

  try {
    const url = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
    url.searchParams.set("query", query);
    url.searchParams.set("count", "1");
    const response = await fetch(url, { headers: { "x-ncp-apigw-api-key-id": clientId, "x-ncp-apigw-api-key": clientSecret, Accept: "application/json" } });
    if (!response.ok) throw new Error(`NAVER_MAP_${response.status}`);
    const data = await response.json() as { addresses?: GeocodeAddress[] };
    const address = data.addresses?.[0];
    if (!address?.x || !address?.y) return Response.json({ error: "선택한 단지의 좌표를 찾지 못했습니다." }, { status: 404 });
    return Response.json({ lng: Number(address.x), lat: Number(address.y), roadAddress: address.roadAddress || "", jibunAddress: address.jibunAddress || "", source: "NAVER Maps Geocoding" }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    const status = error instanceof Error ? error.message.match(/NAVER_MAP_(\d+)/)?.[1] : "";
    const message = status === "401" || status === "429" ? "네이버 클라우드에서 Maps·Geocoding 권한과 Web 서비스 URL을 확인해주세요." : "단지 위치를 확인하지 못했습니다.";
    return Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
