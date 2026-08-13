import type { BoundaryFeature, Position } from "./geometry";
import type { MapAdjacencyEdge, MapTopologyNode } from "./types";

function points(feature: BoundaryFeature): Position[] {
  const found: Position[] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") found.push([value[0], value[1]]);
    else value.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  return found;
}
export function boundariesTouch(first: BoundaryFeature, second: BoundaryFeature, tolerance = 1e-7) {
  const secondKeys = new Set(points(second).map(([x, y]) => `${Math.round(x / tolerance)}:${Math.round(y / tolerance)}`));
  return points(first).some(([x, y]) => secondKeys.has(`${Math.round(x / tolerance)}:${Math.round(y / tolerance)}`));
}

export function buildAdjacencyContract(entries: Array<{ node: MapTopologyNode; feature: BoundaryFeature }>) {
  const edges: MapAdjacencyEdge[] = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      if (!boundariesTouch(entries[left].feature, entries[right].feature)) continue;
      edges.push({ from: entries[left].node.id, to: entries[right].node.id, relation: "touches", crossesSigungu: entries[left].node.sigunguCode !== entries[right].node.sigunguCode });
    }
  }
  return { nodes: entries.map((entry) => entry.node), edges };
}
