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
