export type Position = [number, number];

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: Position[][];
};

export type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};

export type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

export type BoundaryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: SupportedGeometry;
};

export type BoundaryFeatureCollection = {
  type: "FeatureCollection";
  features: BoundaryFeature[];
};

const EPSILON = 1e-10;

function pointOnSegment(point: Position, start: Position, end: Position, epsilon = EPSILON) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > epsilon) return false;
  return x >= Math.min(x1, x2) - epsilon
    && x <= Math.max(x1, x2) + epsilon
    && y >= Math.min(y1, y2) - epsilon
    && y <= Math.max(y1, y2) + epsilon;
}

export function pointInRing(point: Position, ring: Position[]) {
  if (ring.length < 4) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]))
        / (previousPoint[1] - currentPoint[1]) + currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Position, polygon: Position[][]) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInGeometry(point: Position, geometry: SupportedGeometry) {
  if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

export function pointInFeatureCollection(
  point: Position,
  collection: BoundaryFeatureCollection,
  predicate: (feature: BoundaryFeature) => boolean = () => true,
) {
  return collection.features.some((feature) => predicate(feature) && pointInGeometry(point, feature.geometry));
}

export function featureExtent(feature: BoundaryFeature) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      minLng = Math.min(minLng, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLng = Math.max(maxLng, value[0]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    value.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  return Number.isFinite(minLng) ? { minLng, minLat, maxLng, maxLat } : null;
}

function squaredDistanceToSegment(point: Position, start: Position, end: Position) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const t = Math.max(0, Math.min(1, ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy)));
    x += dx * t;
    y += dy * t;
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function signedDistanceToPolygon(point: Position, polygon: Position[][]) {
  let minimum = Infinity;
  for (const ring of polygon) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      minimum = Math.min(minimum, squaredDistanceToSegment(point, ring[previous], ring[index]));
    }
  }
  const distance = Math.sqrt(minimum);
  return pointInPolygon(point, polygon) ? distance : -distance;
}

function ringArea(ring: Position[]) {
  let area = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    area += ring[previous][0] * ring[index][1] - ring[index][0] * ring[previous][1];
  }
  return Math.abs(area / 2);
}

function polygonVisualCenter(polygon: Position[][], precision: number): Position | null {
  const outer = polygon[0];
  if (!outer?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!width || !height) return pointInPolygon(outer[0], polygon) ? outer[0] : null;

  // Deterministic coarse-to-fine polylabel search. Geographic boundary files
  // are already simplified, so a bounded grid avoids adding a runtime package.
  let best: Position = [(minX + maxX) / 2, (minY + maxY) / 2];
  let bestDistance = signedDistanceToPolygon(best, polygon);
  let step = Math.max(width, height) / 8;
  const target = Math.max(precision, Math.max(width, height) / 4096);
  while (step >= target) {
    const origin = bestDistance >= 0 ? best : [(minX + maxX) / 2, (minY + maxY) / 2] as Position;
    for (let x = Math.max(minX, origin[0] - step * 4); x <= Math.min(maxX, origin[0] + step * 4); x += step) {
      for (let y = Math.max(minY, origin[1] - step * 4); y <= Math.min(maxY, origin[1] + step * 4); y += step) {
        const candidate: Position = [x, y];
        const distance = signedDistanceToPolygon(candidate, polygon);
        if (distance > bestDistance) { best = candidate; bestDistance = distance; }
      }
    }
    step /= 2;
  }
  return bestDistance >= 0 && pointInPolygon(best, polygon) ? best : null;
}

/** Returns a guaranteed interior label point, preferring the largest polygon. */
export function geometryLabelPoint(geometry: SupportedGeometry, precision = 0.00005): Position | null {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const ordered = [...polygons].sort((left, right) => ringArea(right[0] || []) - ringArea(left[0] || []));
  for (const polygon of ordered) {
    const point = polygonVisualCenter(polygon, precision);
    if (point && pointInGeometry(point, geometry)) return point;
  }
  return null;
}
