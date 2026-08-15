import { geometryLabelPoint, pointInGeometry, type BoundaryFeature, type BoundaryFeatureCollection, type Position } from "./geometry.ts";
import type { RegionLevel } from "./types.ts";

export type BoundaryRegion = {
  id: string;
  level: RegionLevel;
  code: string;
  name: string;
  sidoCode: string;
  sidoName: string;
  sigunguCode?: string;
  sigunguName?: string;
  labelPoint: Position;
  feature: BoundaryFeature;
};

export type BoundaryRegistryIssue = {
  index: number;
  code?: string;
  reason: "invalid_geometry" | "invalid_code" | "code_hierarchy_mismatch" | "missing_name" | "duplicate_code" | "label_outside_geometry";
};

const text = (value: unknown) => String(value || "").normalize("NFC").trim();
const digits = (value: unknown) => String(value || "").replace(/\D/g, "");

function expectedLength(level: RegionLevel) {
  return level === "sido" ? 2 : level === "sigungu" ? 5 : 8;
}

export function buildBoundaryRegistry(collection: BoundaryFeatureCollection, level: RegionLevel) {
  const regions: BoundaryRegion[] = [];
  const issues: BoundaryRegistryIssue[] = [];
  const seen = new Set<string>();
  collection.features.forEach((feature, index) => {
    const properties = feature.properties || {};
    const code = digits(properties.code);
    const sidoCode = digits(properties.sidoCode) || code.slice(0, 2);
    const sigunguCode = digits(properties.sigunguCode) || (level !== "sido" ? code.slice(0, 5) : "");
    const name = text(properties.name || (level === "sido" ? properties.sidoName : level === "sigungu" ? properties.sigunguName : properties.adminDongName));
    const sidoName = text(properties.sidoName || (level === "sido" ? name : ""));
    const sigunguName = text(properties.sigunguName || (level === "sigungu" ? name : ""));
    if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) { issues.push({ index, code, reason: "invalid_geometry" }); return; }
    if (code.length !== expectedLength(level)) { issues.push({ index, code, reason: "invalid_code" }); return; }
    // EMD geometry uses the SGIS eight-digit boundary code. It is a separate
    // namespace from the MOIS/Kakao sido, sigungu, h_code and b_code values,
    // so an EMD code must never be rejected only because its prefix differs.
    const hierarchyMismatch = level === "sido"
      ? code !== sidoCode
      : level === "sigungu"
        ? code.slice(0, 2) !== sidoCode || code !== sigunguCode
        : !/^\d{2}$/.test(sidoCode) || !/^\d{5}$/.test(sigunguCode);
    if (hierarchyMismatch) {
      issues.push({ index, code, reason: "code_hierarchy_mismatch" }); return;
    }
    if (!name || !sidoName || (level !== "sido" && !sigunguName)) { issues.push({ index, code, reason: "missing_name" }); return; }
    if (seen.has(code)) { issues.push({ index, code, reason: "duplicate_code" }); return; }
    const labelPoint = geometryLabelPoint(feature.geometry);
    if (!labelPoint || !pointInGeometry(labelPoint, feature.geometry)) { issues.push({ index, code, reason: "label_outside_geometry" }); return; }
    seen.add(code);
    regions.push({ id: `${level}:${code}`, level, code, name, sidoCode, sidoName, sigunguCode: sigunguCode || undefined, sigunguName: sigunguName || undefined, labelPoint, feature });
  });
  return { regions, issues, valid: issues.length === 0 };
}
