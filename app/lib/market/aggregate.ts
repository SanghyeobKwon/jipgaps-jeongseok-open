import type {
  AggregatePoint,
  AggregateSummary,
  AggregationInput,
  DataState,
  RollingQuarterAggregate,
  SampleStatus,
} from "./types";

const M2_PER_PYEONG = 3.305785;

export function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

export function shiftMonth(month: string, offset: number): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`잘못된 월 형식입니다: ${month}`);
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  if (from > to) return [];
  const months: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
    if (months.length > 1_200) throw new Error("월 범위가 허용 길이를 초과했습니다.");
  }
  return months;
}

function sampleStatus(count: number, minimumRequired: number, partial: boolean): SampleStatus {
  if (partial) return { state: "partial", count, minimumRequired, reason: "일부 원본 응답을 수집하지 못했습니다." };
  if (count === 0) return { state: "none", count, minimumRequired, reason: "해당 기간에 신고 거래가 없습니다." };
  if (count < minimumRequired) return { state: "low", count, minimumRequired, reason: `최소 ${minimumRequired}건이 필요합니다.` };
  return { state: "sufficient", count, minimumRequired };
}

function unitPrices(rows: AggregationInput[]) {
  const perM2: number[] = [];
  const perPyeong: number[] = [];
  for (const row of rows) {
    const area = row.areaMeasurement?.valueM2 ?? row.area ?? 0;
    if (!(area > 0)) continue;
    perM2.push(row.amount / area);
    perPyeong.push(row.amount / (area / M2_PER_PYEONG));
  }
  return { perM2, perPyeong };
}

export function summarize(rows: AggregationInput[], minimumRequired = 3, partial = false): AggregateSummary {
  const { perM2, perPyeong } = unitPrices(rows);
  return {
    medianAmountManwon: median(rows.map((row) => row.amount)),
    medianPerM2Manwon: median(perM2),
    medianPerPyeongManwon: median(perPyeong),
    volume: rows.length,
    sample: sampleStatus(rows.length, minimumRequired, partial),
  };
}

export function monthlySeries(
  rows: AggregationInput[],
  from: string,
  to: string,
  minimumRequired = 2,
  partialMonths: ReadonlySet<string> = new Set(),
): AggregatePoint[] {
  const grouped = new Map<string, AggregationInput[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    if (month < from || month > to) continue;
    grouped.set(month, [...(grouped.get(month) ?? []), row]);
  }
  return monthRange(from, to).map((month) => ({
    month,
    ...summarize(grouped.get(month) ?? [], minimumRequired, partialMonths.has(month)),
  }));
}

export function rollingQuarter(
  rows: AggregationInput[],
  anchorMonth: string,
  minimumRequired = 3,
  partialMonths: ReadonlySet<string> = new Set(),
): RollingQuarterAggregate {
  const currentMonths = [-2, -1, 0].map((offset) => shiftMonth(anchorMonth, offset));
  const previousMonths = [-5, -4, -3].map((offset) => shiftMonth(anchorMonth, offset));
  const currentRows = rows.filter((row) => currentMonths.includes(row.date.slice(0, 7)));
  const previousRows = rows.filter((row) => previousMonths.includes(row.date.slice(0, 7)));
  const current = summarize(currentRows, minimumRequired, currentMonths.some((month) => partialMonths.has(month)));
  const previous = summarize(previousRows, minimumRequired, previousMonths.some((month) => partialMonths.has(month)));
  const before = previous.medianAmountManwon;
  const latest = current.medianAmountManwon;
  const comparable = current.sample.state === "sufficient" && previous.sample.state === "sufficient";
  return {
    anchorMonth,
    currentMonths,
    previousMonths,
    current,
    previous,
    changePct: comparable && before && latest !== null ? (latest / before - 1) * 100 : null,
  };
}

export function combineDataState(successful: number, failed: number, rowCount: number): DataState {
  if (failed > 0) return "partial";
  if (successful > 0 && rowCount === 0) return "empty";
  return "ok";
}
