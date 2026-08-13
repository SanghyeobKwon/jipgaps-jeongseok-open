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
