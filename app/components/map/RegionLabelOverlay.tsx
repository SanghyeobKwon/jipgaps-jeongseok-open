"use client";

import type { VisibleRegionLabel } from "../../lib/map/labels";

export function RegionLabelOverlay({ labels, onSelect }: { labels: VisibleRegionLabel[]; onSelect: (id: string) => void }) {
  return (
    <div className="map-region-label-overlay" aria-label="지도 행정구역 선택">
      {labels.map((label) => (
        <button
          key={label.id}
          type="button"
          className={`map-region-label${label.selected ? " is-selected" : ""}`}
          style={{ position: "absolute", left: label.x, top: label.y, minWidth: label.width, minHeight: 44, transform: "translate(-50%, -50%)" }}
          aria-label={`${label.name} 선택`}
          aria-pressed={Boolean(label.selected)}
          onClick={() => onSelect(label.id)}
        >
          {label.name}
        </button>
      ))}
    </div>
  );
}
