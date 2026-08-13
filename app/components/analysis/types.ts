import type { ReactNode } from "react";
import type { PropertyType, SampleStatus } from "@/app/lib/market/types";

export type PriceBucket = 1 | 2 | 3 | 4 | 5 | null;

export type ResearchView =
  | "recent-decline"
  | "record-high"
  | "growth-leaders"
  | "price-per-pyeong"
  | "price-trend"
  | "complex-compare";

export type ResearchValueTone = "neutral" | "up" | "down" | "muted";

export interface ResearchCell {
  key: string;
  label: string;
  value: ReactNode;
  mobilePriority?: "primary" | "secondary" | "detail";
  numeric?: boolean;
  sortDirection?: "ascending" | "descending" | "none";
  tone?: ResearchValueTone;
}

export interface ResearchPropertyRow {
  key: string;
  rank: number;
  name: string;
  dong: string;
  propertyType: PropertyType;
  priceBucket: PriceBucket;
  selected?: boolean;
  sample: SampleStatus;
  cells: ResearchCell[];
}

export interface AreaPriceRow {
  key: string;
  areaM2: number;
  pyeong: number;
  latestAmountLabel: string;
  medianAmountLabel: string;
  perPyeongLabel: string;
  highLabel: string;
  lowLabel: string;
  quarterVolume: number;
  changeLabel: string | null;
  latestContractDate: string | null;
  sample: SampleStatus;
}

export interface PropertyMetric {
  key: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: ResearchValueTone;
}

export interface LivingCategory {
  key: string;
  label: string;
  count: number | null;
  icon?: ReactNode;
}

export interface NearbyFacility {
  key: string;
  name: string;
  category: string;
  distanceLabel: string;
  travelTimeLabel?: string;
  selected?: boolean;
}

export interface PropertyDecisionData {
  key: string;
  name: string;
  address: string;
  propertyType: PropertyType;
  priceBucket: PriceBucket;
  areaLabel?: string;
  latestPriceLabel: string;
  latestContractDate?: string | null;
  sample: SampleStatus;
  metrics: PropertyMetric[];
  areaPrices: AreaPriceRow[];
}

