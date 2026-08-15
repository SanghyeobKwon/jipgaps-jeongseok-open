import { loadEmdBoundaries, validateBoundaryPoint } from "./boundaries";
import { KakaoLocalError, reverseRegionCode, searchKakaoLocal, type KakaoLocalDocument } from "./kakao-local";
import { selectRegionDocuments, validateRegionScope } from "./region-codes";
import type { MapScope } from "./types";

export type VerifiedGeocode = {
  x: string; y: string; roadAddress: string; jibunAddress: string;
  codes: { sidoCode?: string; sigunguCode?: string; adminDongCode?: string; adminDongName?: string; legalDongCode?: string; legalDongName?: string; boundaryAdminCode?: string };
};

export type GeocodeResult = { address: VerifiedGeocode | null; rejected: number; rejectionReasons: string[] };

export function isKoreanWgs84(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 32 && lat <= 40 && lng >= 123 && lng <= 133;
}

function normalizeDocument(document: KakaoLocalDocument) {
  return {
    x: document.x || "", y: document.y || "",
    roadAddress: document.road_address?.address_name || document.road_address_name || "",
    jibunAddress: document.address?.address_name || document.address_name || "",
  };
}

export async function validateCoordinate(
  lat: number,
  lng: number,
  scope: Partial<MapScope>,
  origin: string,
  restApiKey: string,
) {
  if (!isKoreanWgs84(lat, lng)) return { valid: false, reasons: ["wgs84_out_of_range"] };
  const reverse = await reverseRegionCode(lat, lng, restApiKey);
  const codes = validateRegionScope(scope, selectRegionDocuments(reverse.documents || []));
  if (!codes.valid) return { valid: false, reasons: codes.reasons, codes };
  try {
    const boundaries = await loadEmdBoundaries(origin, codes.sigunguCode!);
    const boundary = validateBoundaryPoint([lng, lat], boundaries, { ...scope, sigunguCode: codes.sigunguCode });
    if (!boundary.valid) return { valid: false, reasons: [boundary.candidateCount ? "outside_boundary" : "boundary_scope_missing"], codes };
  } catch {
    return { valid: false, reasons: ["boundary_unavailable"], codes };
  }
  return { valid: true, reasons: [], codes };
}

export async function resolveGeocode(query: string, scope: Partial<MapScope>, origin: string, restApiKey: string): Promise<GeocodeResult> {
  const addressResponse = await searchKakaoLocal("address", query, restApiKey);
  let documents = addressResponse.documents || [];
  if (!documents.length) documents = (await searchKakaoLocal("keyword", query, restApiKey)).documents || [];
  let rejected = 0;
  const rejectionReasons: string[] = [];
  for (const raw of documents.slice(0, 15)) {
    const candidate = normalizeDocument(raw);
    const lat = Number(candidate.y); const lng = Number(candidate.x);
    const validation = await validateCoordinate(lat, lng, scope, origin, restApiKey);
    if (!validation.valid) {
      rejected += 1; rejectionReasons.push(...validation.reasons); continue;
    }
    return { address: { ...candidate, codes: { ...validation.codes, boundaryAdminCode: scope.boundaryAdminCode } }, rejected, rejectionReasons };
  }
  return { address: null, rejected, rejectionReasons };
}

export { KakaoLocalError };
