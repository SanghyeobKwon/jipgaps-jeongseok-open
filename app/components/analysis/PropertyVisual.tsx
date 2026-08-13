import {
  Building2,
  Building,
  Factory,
  Home,
  Landmark,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { PropertyType } from "@/app/lib/market/types";
import type { PriceBucket } from "./types";

const PROPERTY_META: Record<PropertyType, { label: string; icon: LucideIcon }> = {
  apt: { label: "아파트", icon: Building2 },
  officetel: { label: "오피스텔", icon: Building },
  rowhouse: { label: "연립·다세대", icon: Landmark },
  house: { label: "단독·다가구", icon: Home },
  commercial: { label: "상가·업무", icon: Warehouse },
  factory: { label: "공장·창고", icon: Factory },
};

export interface PropertyTypeIconProps {
  type: PropertyType;
  priceBucket?: PriceBucket;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
}
export function PropertyTypeIcon({ type, priceBucket = null, selected = false, size = "md", className }: PropertyTypeIconProps) {
  const meta = PROPERTY_META[type];
  const Icon = meta.icon;
  const bucketClass = priceBucket === null ? "is-unavailable" : `is-bucket-${priceBucket}`;

  return (
    <span
      className={["analysis-property-icon", `is-${size}`, bucketClass, selected && "is-selected", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${meta.label}${priceBucket === null ? ", 가격 구간 미확인" : `, 가격 ${priceBucket}단계`}${selected ? ", 선택됨" : ""}`}
      title={meta.label}
    >
      <Icon aria-hidden="true" strokeWidth={1.9} />
    </span>
  );
}

export function PriceBucketLegend() {
  return (
    <div className="analysis-price-legend" aria-label="가격 구간 범례">
      <span>낮은 가격대</span>
      <ol>
        {[1, 2, 3, 4, 5].map((bucket) => <li key={bucket} className={`is-bucket-${bucket}`}><span className="hmi-sr-only">{bucket}단계</span></li>)}
      </ol>
      <span>높은 가격대</span>
    </div>
  );
}
