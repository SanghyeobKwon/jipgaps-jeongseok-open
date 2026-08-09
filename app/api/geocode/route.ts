export const dynamic = "force-dynamic";

type GeocodeAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  x?: string;
  y?: string;
};

function safeQuery(value: string | null, maxLength = 160) {
  return (value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAddress(value = "") {
  return value
    .replace(/서울시/g, "서울특별시")
    .replace(/부산시/g, "부산광역시")
    .replace(/대구시/g, "대구광역시")
    .replace(/인천시/g, "인천광역시")
    .replace(/대전시/g, "대전광역시")
    .replace(/울산시/g, "울산광역시")
    .replace(/광주시/g, "광주광역시")
    .replace(/\s+/g, "");
}

function matchesScope(address: GeocodeAddress, scopes: string[]) {
  if (!scopes.length) return true;
  const haystack = normalizeAddress(`${address.roadAddress || ""} ${address.jibunAddress || ""}`);
  return scopes.every((scope) => haystack.includes(normalizeAddress(scope)));
}

export async function fetchGeocode(query: string, scopes: string[] = []) {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("NAVER_MAP_NOT_CONFIGURED");

  const url = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
  url.searchParams.set("query", query);
  url.searchParams.set("count", "10");
  const response = await fetch(url, {
    headers: {
      "x-ncp-apigw-api-key-id": clientId,
      "x-ncp-apigw-api-key": clientSecret,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`NAVER_MAP_${response.status}`);

  const data = (await response.json()) as { addresses?: GeocodeAddress[] };
  const candidates = (data.addresses || []).filter((address) => address.x && address.y);
  return candidates.find((address) => matchesScope(address, scopes)) || null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = safeQuery(params.get("query"));
  const sido = safeQuery(params.get("sido"), 30);
  const sigungu = safeQuery(params.get("sigungu"), 40);
  const dong = safeQuery(params.get("dong"), 30);
  if (!query) return Response.json({ error: "주소 검색어가 필요합니다." }, { status: 400 });

  try {
    const address = await fetchGeocode(query, [sido, sigungu, dong].filter(Boolean));
    if (!address?.x || !address?.y) {
      return Response.json({ error: "선택 지역 안에서 해당 건물 좌표를 찾지 못했습니다." }, { status: 404 });
    }

    return Response.json(
      {
        lng: Number(address.x),
        lat: Number(address.y),
        roadAddress: address.roadAddress || "",
        jibunAddress: address.jibunAddress || "",
        source: "NAVER Maps Geocoding",
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "NAVER_MAP_NOT_CONFIGURED"
      ? "네이버 지도 API가 아직 연결되지 않았습니다."
      : /NAVER_MAP_(401|403|429)/.test(code)
        ? "네이버 클라우드의 Maps·Geocoding 권한과 Web 서비스 URL을 확인해주세요."
        : "건물 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
    return Response.json({ error: message }, { status: code === "NAVER_MAP_NOT_CONFIGURED" ? 503 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
