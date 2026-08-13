import type { BoundaryRegion } from "./boundary-registry.ts";
import type { RegionNavigationChange, RegionSelection } from "./types.ts";

export function regionSelectionFromBoundary(region: BoundaryRegion, current?: RegionSelection): RegionNavigationChange {
  const sameRegion = current?.level === region.level
    && (region.level === "sido" ? current.sidoCode === region.code
      : region.level === "sigungu" ? current.sigunguCode === region.code
        : current.boundaryAdminCode === region.code);
  if (sameRegion && current) return { selection: current, cleared: [], history: "replace" };
  const base = { sidoCode: region.sidoCode, sidoName: region.sidoName };
  if (region.level === "sido") {
    return { selection: { level: "sido", ...base }, cleared: ["sigungu", "dong", "property", "area", "tradePy"], history: "push" };
  }
  if (region.level === "sigungu") {
    return {
      selection: { level: "sigungu", ...base, sigunguCode: region.code, sigunguName: region.name },
      cleared: ["dong", "property", "area", "tradePy"], history: "push",
    };
  }
  return {
    selection: { level: "emd", ...base, sigunguCode: region.sigunguCode, sigunguName: region.sigunguName, boundaryAdminCode: region.code, adminDongName: region.name },
    cleared: ["property", "area", "tradePy"], history: "push",
  };
}

export function selectionToQuery(selection: RegionSelection) {
  const params = new URLSearchParams();
  // Existing public URL contract stores the display name for sido and the
  // official five-digit code for sigungu. Do not overload hcode with SGIS
  // boundaryAdminCode: Kakao h_code and SGIS codes are distinct systems.
  params.set("sido", selection.sidoName);
  if (selection.sigunguCode) params.set("sigungu", selection.sigunguCode);
  if (selection.adminDongCode) params.set("hcode", selection.adminDongCode);
  if (selection.legalDongCode) params.set("bcode", selection.legalDongCode);
  if (selection.propertyKey) params.set("property", selection.propertyKey);
  if (selection.camera) {
    params.set("lat", String(selection.camera.lat));
    params.set("lng", String(selection.camera.lng));
    params.set("level", String(selection.camera.level));
  }
  return params;
}
