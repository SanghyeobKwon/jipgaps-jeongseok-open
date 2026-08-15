export type MarkerViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type MapMarkerCandidate = {
  key: string;
  lat: number;
  lng: number;
  count: number;
  lastAmount: number;
  scope: "selected" | "nearby";
};

function markerLimit(level: number) {
  if (level <= 4) return 90;
  if (level === 5) return 60;
  if (level === 6) return 42;
  return 28;
}

export function selectVisibleMapMarkerKeys(
  candidates: MapMarkerCandidate[],
  viewport: MarkerViewport,
  level: number,
  selectedKey: string,
) {
  const visible = candidates
    .filter((candidate) => candidate.lat >= viewport.south && candidate.lat <= viewport.north && candidate.lng >= viewport.west && candidate.lng <= viewport.east)
    .sort((left, right) => {
      if (left.key === selectedKey) return -1;
      if (right.key === selectedKey) return 1;
      if (left.scope !== right.scope) return left.scope === "selected" ? -1 : 1;
      return right.count - left.count || right.lastAmount - left.lastAmount || left.key.localeCompare(right.key, "ko");
    });

  return new Set(visible.slice(0, markerLimit(level)).map((candidate) => candidate.key));
}
