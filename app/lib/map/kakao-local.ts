import type { KakaoRegionDocument } from "./region-codes";

export type KakaoFailureKind = "authentication" | "quota" | "timeout" | "upstream";

export class KakaoLocalError extends Error {
  constructor(public kind: KakaoFailureKind, public status?: number) {
    super(`KAKAO_LOCAL_${kind.toUpperCase()}${status ? `_${status}` : ""}`);
  }
}
export type KakaoLocalDocument = {
  id?: string; place_name?: string; category_name?: string; address_name?: string;
  road_address_name?: string; x?: string; y?: string; distance?: string;
  road_address?: { address_name?: string } | null;
  address?: { address_name?: string } | null;
};

async function kakaoRequest<T>(url: URL, restApiKey: string, timeoutMs = 9000): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `KakaoAK ${restApiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 401 || response.status === 403) throw new KakaoLocalError("authentication", response.status);
    if (response.status === 429) throw new KakaoLocalError("quota", response.status);
    if (!response.ok) throw new KakaoLocalError("upstream", response.status);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof KakaoLocalError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new KakaoLocalError("timeout");
    }
    throw new KakaoLocalError("upstream");
  }
}

export async function searchKakaoLocal(
  path: "address" | "keyword",
  query: string,
  restApiKey: string,
  spatial?: { lat: number; lng: number; radius: number },
) {
  const url = new URL(`https://dapi.kakao.com/v2/local/search/${path}.json`);
  url.searchParams.set("query", query);
  url.searchParams.set("size", "15");
  if (path === "address") url.searchParams.set("analyze_type", "similar");
  if (spatial) {
    url.searchParams.set("x", String(spatial.lng));
    url.searchParams.set("y", String(spatial.lat));
    url.searchParams.set("radius", String(spatial.radius));
    url.searchParams.set("sort", "distance");
  }
  return kakaoRequest<{ documents?: KakaoLocalDocument[] }>(url, restApiKey);
}

export async function reverseRegionCode(lat: number, lng: number, restApiKey: string) {
  const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json");
  url.searchParams.set("x", String(lng));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("input_coord", "WGS84");
  return kakaoRequest<{ documents?: KakaoRegionDocument[] }>(url, restApiKey);
}
