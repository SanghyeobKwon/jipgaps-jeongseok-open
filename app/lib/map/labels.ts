import { pointInGeometry, type Position } from "./geometry.ts";
import type { BoundaryRegion } from "./boundary-registry.ts";
import type { RegionLevel } from "./types.ts";

export type RegionLabelCandidate = {
  id: string;
  code: string;
  name: string;
  point: Position;
  level: RegionLevel;
  selected?: boolean;
  sameParent?: boolean;
};

export type VisibleRegionLabel = RegionLabelCandidate & { x: number; y: number; width: number; height: number; priority: number };

export type InteractiveRegionLabelFallback = RegionLabelCandidate & {
  reason: "collision" | "outside_viewport";
};

export type RegionLabelLayout = {
  visible: VisibleRegionLabel[];
  fallback: InteractiveRegionLabelFallback[];
};

export function officialRegionLabelCandidates(
  regions: BoundaryRegion[],
  options: { selectedCode?: string; sameParentCodes?: ReadonlySet<string> } = {},
): RegionLabelCandidate[] {
  return regions.map((region) => {
    if (!region.code || !region.name || !pointInGeometry(region.labelPoint, region.feature.geometry)) {
      throw new Error(`Invalid official boundary label: ${region.id}`);
    }
    return {
      id: region.id,
      code: region.code,
      name: region.name,
      point: region.labelPoint,
      level: region.level,
      selected: region.code === options.selectedCode,
      sameParent: options.sameParentCodes?.has(region.code) ?? false,
    };
  });
}

export function labelPriority(candidate: RegionLabelCandidate) {
  if (candidate.selected) return 400;
  if (candidate.sameParent) return 300;
  if (candidate.level === "sigungu" || candidate.level === "emd") return 200;
  return 100;
}

function overlaps(first: VisibleRegionLabel, second: VisibleRegionLabel, gap: number) {
  return Math.abs(first.x - second.x) * 2 < first.width + second.width + gap * 2
    && Math.abs(first.y - second.y) * 2 < first.height + second.height + gap * 2;
}

/**
 * Keeps selected and local labels first. `project` must use the actual map
 * viewport (excluding an open side panel), not the browser window.
 */
export function resolveLabelCollisions(
  candidates: RegionLabelCandidate[],
  project: (point: Position) => { x: number; y: number },
  viewport: { width: number; height: number },
  options: { fontSize?: number; paddingX?: number; height?: number; gap?: number } = {},
) {
  return resolveRegionLabelLayout(candidates, project, viewport, options).visible;
}

/**
 * Resolves direct labels without losing region identity. Labels that cannot be
 * placed are returned for an always-interactive fallback list or inspector.
 */
export function resolveRegionLabelLayout(
  candidates: RegionLabelCandidate[],
  project: (point: Position) => { x: number; y: number },
  viewport: { width: number; height: number },
  options: { fontSize?: number; paddingX?: number; height?: number; gap?: number } = {},
): RegionLabelLayout {
  const fontSize = options.fontSize ?? 13;
  const paddingX = options.paddingX ?? 8;
  const height = options.height ?? 24;
  const gap = options.gap ?? 3;
  const accepted: VisibleRegionLabel[] = [];
  const fallback: InteractiveRegionLabelFallback[] = [];
  const sorted = candidates.map((candidate) => {
    const { x, y } = project(candidate.point);
    return { ...candidate, x, y, width: Math.max(44, [...candidate.name].length * fontSize + paddingX * 2), height: Math.max(24, height), priority: labelPriority(candidate) };
  }).sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  for (const candidate of sorted) {
    const inside = candidate.x - candidate.width / 2 >= 0
      && candidate.y - candidate.height / 2 >= 0
      && candidate.x + candidate.width / 2 <= viewport.width
      && candidate.y + candidate.height / 2 <= viewport.height;
    const collides = accepted.some((label) => overlaps(label, candidate, gap));
    if (!inside || collides) {
      if (candidate.selected) {
        accepted.push({
          ...candidate,
          x: Math.max(candidate.width / 2, Math.min(viewport.width - candidate.width / 2, candidate.x)),
          y: Math.max(candidate.height / 2, Math.min(viewport.height - candidate.height / 2, candidate.y)),
        });
      } else {
        fallback.push({
          id: candidate.id,
          code: candidate.code,
          name: candidate.name,
          point: candidate.point,
          level: candidate.level,
          selected: candidate.selected,
          sameParent: candidate.sameParent,
          reason: inside ? "collision" : "outside_viewport",
        });
      }
      continue;
    }
    accepted.push(candidate);
  }
  return { visible: accepted, fallback };
}
