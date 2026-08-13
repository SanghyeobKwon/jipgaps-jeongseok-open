import { buildBoundaryRegistry } from "./boundary-registry.ts";
import { pointInFeatureCollection, type BoundaryFeatureCollection, type Position } from "./geometry";
import type { MapScope } from "./types";

const boundaryCache = new Map<string, Promise<BoundaryFeatureCollection>>();

export type BoundaryDatasetRequest =
  | { level: "sido" }
  | { level: "sigungu"; sidoCode: string }
  | { level: "emd"; sigunguCode: string };

function boundaryPath(request: BoundaryDatasetRequest) {
  if (request.level === "sido") return "/data/boundaries/sido.json";
  if (request.level === "sigungu") {
    if (!/^\d{2}$/.test(request.sidoCode)) throw new Error("BOUNDARY_CODE_INVALID");
    return `/data/boundaries/sgg/${request.sidoCode}.json`;
  }
  if (!/^\d{5}$/.test(request.sigunguCode)) throw new Error("BOUNDARY_CODE_INVALID");
  return `/data/boundaries/emd/${request.sigunguCode}.json`;
}

export async function loadBoundaryDataset(origin: string, request: BoundaryDatasetRequest) {
  const url = new URL(boundaryPath(request), origin).toString();
  if (!boundaryCache.has(url)) {
    boundaryCache.set(url, fetch(url, { signal: AbortSignal.timeout(5000) }).then(async (response) => {
      if (!response.ok) throw new Error(`BOUNDARY_${response.status}`);
      const value = await response.json() as BoundaryFeatureCollection;
      if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) throw new Error("BOUNDARY_SCHEMA_INVALID");
      const registry = buildBoundaryRegistry(value, request.level);
      if (!registry.valid) throw new Error(`BOUNDARY_REGISTRY_INVALID:${registry.issues[0]?.reason || "unknown"}`);
      return value;
    }).catch((error) => {
      boundaryCache.delete(url);
      throw error;
    }));
  }
  return boundaryCache.get(url)!;
}

export async function loadEmdBoundaries(origin: string, sigunguCode: string) {
  return loadBoundaryDataset(origin, { level: "emd", sigunguCode });
}
export function validateBoundaryPoint(point: Position, collection: BoundaryFeatureCollection, scope: Partial<MapScope>) {
  const matching = (feature: BoundaryFeatureCollection["features"][number]) => {
    const properties = feature.properties;
    if (scope.boundaryAdminCode) return String(properties.code || "") === scope.boundaryAdminCode;
    if (scope.adminDongName) return String(properties.name || "").normalize("NFC") === scope.adminDongName.normalize("NFC");
    return !scope.sigunguCode || String(properties.sigunguCode || "") === scope.sigunguCode;
  };
  const candidates = collection.features.filter(matching);
  return { valid: candidates.length > 0 && pointInFeatureCollection(point, collection, matching), candidateCount: candidates.length };
}
