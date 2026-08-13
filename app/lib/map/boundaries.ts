import { pointInFeatureCollection, type BoundaryFeatureCollection, type Position } from "./geometry";
import type { MapScope } from "./types";

const boundaryCache = new Map<string, Promise<BoundaryFeatureCollection>>();

export async function loadEmdBoundaries(origin: string, sigunguCode: string) {
  if (!/^\d{5}$/.test(sigunguCode)) throw new Error("BOUNDARY_CODE_INVALID");
  const url = new URL(`/data/boundaries/emd/${sigunguCode}.json`, origin).toString();
  if (!boundaryCache.has(url)) {
    boundaryCache.set(url, fetch(url, { signal: AbortSignal.timeout(5000) }).then(async (response) => {
      if (!response.ok) throw new Error(`BOUNDARY_${response.status}`);
      const value = await response.json() as BoundaryFeatureCollection;
      if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) throw new Error("BOUNDARY_SCHEMA_INVALID");
      return value;
    }).catch((error) => {
      boundaryCache.delete(url);
      throw error;
    }));
  }
  return boundaryCache.get(url)!;
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
