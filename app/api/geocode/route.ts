export const dynamic = "force-dynamic";

type GeocodeAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDocument = {
  address_name?: string;
  x?: string;
  y?: string;
  road_address?: { address_name?: string } | null;
  address?: { address_name?: string } | null;
};

type KakaoKeywordDocument = {
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

function safeQuery(value: string | null, maxLength = 160) {
  return (value || "").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAddress(value = "") {
  return value
    .replace(/서울특별시|서울시/g, "서울")
    .replace(/부산광역시|부산시/g, "부산")
    .replace(/대구광역시|대구시/g, "대구")
    .replace(/인천광역시|인천시/g, "인천")
    .replace(/대전광역시|대전시/g, "대전")
    .replace(/울산광역시|울산시/g, "울산")
    .replace(/광주광역시|광주시/g, "광주")
    .replace(/세종특별자치시|세종시/g, "세종")
    .replace(/경기도/g, "경기")
    .replace(/강원특별자치도|강원도/g, "강원")
    .replace(/충청북도/g, "충북")
    .replace(/충청남도/g, "충남")
    .replace(/전북특별자치도|전라북도/g, "전북")
    .replace(/전남광주통합특별시/g, "전남광주")
    .replace(/전라남도/g, "전남")
    .replace(/경상북도/g, "경북")
    .replace(/경상남도/g, "경남")
    .replace(/제주특별자치도|제주도/g, "제주")
    .replace(/([가-힣]+?)(?:본|\d+)동/g, "$1동")
    .replace(/\s+/g, "");
}

function matchesScope(address: GeocodeAddress, scopes: string[]) {
  if (!scopes.length) return true;
  const haystack = normalizeAddress(`${address.roadAddress || ""} ${address.jibunAddress || ""}`);
  return scopes.every((scope) => haystack.includes(normalizeAddress(scope)));
}

async function kakaoLocal(path: "address" | "keyword", query: string, restApiKey: string) {
  const url = new URL(`https://dapi.kakao.com/v2/local/search/${path}.json`);
  url.searchParams.set("query", query);
  url.searchParams.set("size", "15");
  if (path === "address") url.searchParams.set("analyze_type", "similar");
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${restApiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`KAKAO_LOCAL_${response.status}`);
  return response.json() as Promise<{ documents?: Array<KakaoAddressDocument | KakaoKeywordDocument> }>;
}

function normalizeDocument(document: KakaoAddressDocument | KakaoKeywordDocument): GeocodeAddress {
  const addressDocument = document as KakaoAddressDocument;
  const keywordDocument = document as KakaoKeywordDocument;
  return {
    x: document.x,
    y: document.y,
    roadAddress: addressDocument.road_address?.address_name || keywordDocument.road_address_name || "",
    jibunAddress: addressDocument.address?.address_name || document.address_name || "",
  };
}

export async function fetchGeocode(query: string, scopes: string[] = []) {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) throw new Error("KAKAO_MAP_NOT_CONFIGURED");

  const addressData = await kakaoLocal("address", query, restApiKey);
  let candidates = (addressData.documents || []).map(normalizeDocument).filter((address) => address.x && address.y);
  if (!candidates.length) {
    const keywordData = await kakaoLocal("keyword", query, restApiKey);
    candidates = (keywordData.documents || []).map(normalizeDocument).filter((address) => address.x && address.y);
  }
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
        source: "Kakao Local Geocoding",
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "KAKAO_MAP_NOT_CONFIGURED"
      ? "카카오 REST API 키가 아직 연결되지 않았습니다."
      : /KAKAO_LOCAL_(401|403|429)/.test(code)
        ? "카카오 로컬 API 권한과 REST API 키를 확인해주세요."
        : "건물 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
    return Response.json({ error: message }, { status: code === "KAKAO_MAP_NOT_CONFIGURED" ? 503 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
