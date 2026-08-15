import type { MapScope } from "./types";

export type KakaoRegionDocument = {
  region_type?: "H" | "B" | string;
  code?: string;
  address_name?: string;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  region_4depth_name?: string;
  x?: number;
  y?: number;
};

export type ResolvedRegionCodes = {
  administrative: KakaoRegionDocument | null;
  legal: KakaoRegionDocument | null;
};

export type ScopeValidation = {
  valid: boolean;
  reasons: string[];
  sidoCode?: string;
  sigunguCode?: string;
  adminDongCode?: string;
  adminDongName?: string;
  legalDongCode?: string;
  legalDongName?: string;
};

export function cleanRegionCode(value: unknown, length?: number) {
  const code = String(value || "").replace(/\D/g, "");
  if (!code || (length !== undefined && code.length !== length)) return "";
  return code;
}

export function canonicalRegionName(value: unknown) {
  return String(value || "").normalize("NFC").replace(/\s+/g, "").trim();
}

export function selectRegionDocuments(documents: KakaoRegionDocument[]): ResolvedRegionCodes {
  return {
    administrative: documents.find((document) => document.region_type === "H") || null,
    legal: documents.find((document) => document.region_type === "B") || null,
  };
}

function compareCode(reasons: string[], label: string, expected: string | undefined, actual: string | undefined) {
  if (expected && cleanRegionCode(expected) !== cleanRegionCode(actual)) reasons.push(`${label}_code_mismatch`);
}

function compareName(reasons: string[], label: string, expected: string | undefined, actual: string | undefined) {
  if (expected && canonicalRegionName(expected) !== canonicalRegionName(actual)) reasons.push(`${label}_name_mismatch`);
}

export function validateRegionScope(scope: Partial<MapScope>, regions: ResolvedRegionCodes): ScopeValidation {
  const reasons: string[] = [];
  const administrativeCode = cleanRegionCode(regions.administrative?.code);
  const legalCode = cleanRegionCode(regions.legal?.code);
  const referenceCode = administrativeCode || legalCode;
  const sidoCode = referenceCode.slice(0, 2);
  const sigunguCode = referenceCode.slice(0, 5);

  compareCode(reasons, "sido", scope.sidoCode, sidoCode);
  compareCode(reasons, "sigungu", scope.sigunguCode, sigunguCode);
  compareCode(reasons, "admin_dong", scope.adminDongCode, administrativeCode);
  compareCode(reasons, "legal_dong", scope.legalDongCode, legalCode);
  compareName(reasons, "sido", scope.sidoName, regions.legal?.region_1depth_name || regions.administrative?.region_1depth_name);
  compareName(reasons, "sigungu", scope.sigunguName, regions.legal?.region_2depth_name || regions.administrative?.region_2depth_name);
  compareName(reasons, "admin_dong", scope.adminDongName, regions.administrative?.region_3depth_name);
  compareName(reasons, "legal_dong", scope.legalDongName, regions.legal?.region_3depth_name);

  if (!referenceCode || referenceCode.length < 5) reasons.push("region_code_missing");
  if (!regions.administrative) reasons.push("administrative_region_missing");
  if (!regions.legal) reasons.push("legal_region_missing");

  return {
    valid: reasons.length === 0,
    reasons,
    sidoCode,
    sigunguCode,
    adminDongCode: administrativeCode || undefined,
    adminDongName: regions.administrative?.region_3depth_name || undefined,
    legalDongCode: legalCode || undefined,
    legalDongName: regions.legal?.region_3depth_name || undefined,
  };
}

export function scopeFromLegacyNames(sido: string, sigungu: string, legalDong?: string): Partial<MapScope> {
  return {
    sidoName: sido || undefined,
    sigunguName: sigungu || undefined,
    legalDongName: legalDong || undefined,
  };
}
