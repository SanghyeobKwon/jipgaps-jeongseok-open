export type AreaKind = "exclusive" | "grossFloor" | "building" | "land" | "unknown";

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

