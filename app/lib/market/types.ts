export type AreaKind = "exclusive" | "grossFloor" | "building" | "land" | "unknown";

export type PropertyType = "apt" | "rowhouse" | "house" | "officetel" | "commercial" | "factory";

export type AreaMeasurement = {
  valueM2: number | null;
  pyeongEquivalent: number | null;
  kind: AreaKind;
};

export type SampleStatus = {
  state: "sufficient" | "low" | "none" | "partial";
  count: number;
  minimumRequired: number;
  reason?: string;
};

export type PeriodMeta = {
  from: string;
  to: string;
  basis: "calendar-month" | "rolling-quarter";
  completeness: "complete" | "provisional";
};

export type AggregatePoint = {
  month: string;
  medianAmountManwon: number | null;
  medianPerM2Manwon: number | null;
  medianPerPyeongManwon: number | null;
  volume: number;
  sample: SampleStatus;
};

export type AggregateSummary = {
  medianAmountManwon: number | null;
  medianPerM2Manwon: number | null;
  medianPerPyeongManwon: number | null;
  volume: number;
  sample: SampleStatus;
};

export type DataState = "ok" | "partial" | "empty";

export type ResearchMetric =
  | "recent_decline"
  | "highest_price"
  | "top_growth"
  | "price_per_pyeong"
  | "price_change"
  | "complex_compare";

export type ResearchColumnKind = "rank" | "text" | "area" | "price" | "unit-price" | "percent" | "count" | "date";

export type ResearchColumn = {
  key: string;
  label: string;
  kind: ResearchColumnKind;
  sortable: boolean;
};

export type TradeRecord = {
  id: string;
  date: string;
  amount: number;
  area: number;
  floor: number | null;
  name: string;
  propertyKey: string;
  dong: string;
  buildingDong: string;
  jibun: string;
  buildYear: number | null;
  propertyType: PropertyType;
  dealingType: string;
  cancelled: boolean;
  amountManwon: number;
  contractDate: string;
  areaMeasurement: AreaMeasurement;
};

export type AreaPriceSummary = {
  id: string;
  propertyKey: string;
  propertyName: string;
  propertyType: PropertyType;
  dong: string;
  jibun: string;
  buildingDongs: string[];
  areaKind: AreaKind;
  areaBucketM2: number;
  representativeAreaM2: number;
  pyeongEquivalent: number;
  latestTrade: {
    date: string;
    amountManwon: number;
    floor: number | null;
    buildingDong: string;
    pricePerPyeongManwon: number | null;
  } | null;
  highestTrade: {
    date: string;
    amountManwon: number;
    floor: number | null;
    buildingDong: string;
    pricePerPyeongManwon: number | null;
  } | null;
  lowestTrade: {
    date: string;
    amountManwon: number;
    floor: number | null;
    buildingDong: string;
    pricePerPyeongManwon: number | null;
  } | null;
  period: AggregateSummary;
  currentQuarter: AggregateSummary;
  previousQuarter: AggregateSummary;
  changeAmountManwon: number | null;
  changePct: number | null;
  regionMedianPerPyeongManwon: number | null;
  regionDeltaPct: number | null;
  trend: AggregatePoint[];
  sample: SampleStatus;
};

export type ComplexPriceSummary = {
  propertyKey: string;
  propertyName: string;
  propertyType: PropertyType;
  dong: string;
  jibun: string;
  areaSummaryIds: string[];
  areaCount: number;
  tradeCount: number;
  latestTradeDate: string | null;
  medianPerPyeongManwon: number | null;
  sample: SampleStatus;
};

export type ResearchView = {
  metric: ResearchMetric;
  label: string;
  description: string;
  comparisonBasis: string;
  columns: ResearchColumn[];
  rowIds: string[];
};

export type ResearchBundle = {
  status: DataState;
  anchorMonth: string;
  minimumSample: number;
  areaBucketSizeM2: number;
  areaBasis: "exclusive" | "mixed";
  regionMedianPerPyeongManwon: number | null;
  rows: AreaPriceSummary[];
  complexes: ComplexPriceSummary[];
  views: Record<ResearchMetric, ResearchView>;
};

export type PropertySummary = {
  key: string;
  name: string;
  dong: string;
  jibun: string;
  count: number;
  lastAmount: number;
  areas: number[];
  areaKinds: AreaKind[];
};

export type AggregationInput = {
  date: string;
  amount: number;
  area?: number;
  areaMeasurement?: AreaMeasurement;
};

export type RollingQuarterAggregate = {
  anchorMonth: string;
  currentMonths: string[];
  previousMonths: string[];
  current: AggregateSummary;
  previous: AggregateSummary;
  changePct: number | null;
};

export type CollectionMeta = {
  requestedMonths: string[];
  successfulMonths: string[];
  failedMonths: string[];
  fetchedPages: number;
  totalCount: number;
  warnings: string[];
};

export type TradesResponse = {
  trades: TradeRecord[];
  properties: PropertySummary[];
  months: number;
  lawd: string;
  type: PropertyType;
  source: string;
  status: DataState;
  aggregates: {
    monthly: AggregatePoint[];
    rollingQuarter: RollingQuarterAggregate | null;
  };
  research: ResearchBundle;
  meta: CollectionMeta & {
    areaKinds: AreaKind[];
    period: PeriodMeta;
  };
};

export type RepresentativeMarket = {
  short: string;
  sido: string;
  code: string;
  count: number;
  median: number;
  change: number;
  medianAmountManwon: number | null;
  changePct: number | null;
  sample: SampleStatus;
  status: DataState;
};
