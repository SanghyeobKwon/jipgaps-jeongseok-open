import { median, monthlySeries, rollingQuarter, shiftMonth, summarize } from "./aggregate.ts";
import type {
  AreaPriceSummary,
  ComplexPriceSummary,
  DataState,
  ResearchBundle,
  ResearchColumn,
  ResearchMetric,
  ResearchView,
  SampleStatus,
  TradeRecord,
} from "./types.ts";

export const M2_PER_PYEONG = 3.305785;
export const AREA_BUCKET_SIZE_M2 = 0.5;
export const DEFAULT_RESEARCH_MINIMUM_SAMPLE = 3;

type ColumnTuple = readonly [key: string, label: string, kind: ResearchColumn["kind"]];

function columns(items: ColumnTuple[]): ResearchColumn[] {
  return items.map(([key, label, kind]) => ({ key, label, kind, sortable: key !== "rank" }));
}

const VIEW_COLUMNS: Record<ResearchMetric, ResearchColumn[]> = {
  recent_decline: columns([
    ["rank", "순위", "rank"], ["propertyName", "단지", "text"], ["area", "동·평형", "area"],
    ["currentMedian", "최근 중위가", "price"], ["previousMedian", "직전 중위가", "price"],
    ["changeAmount", "하락 금액", "price"], ["changePct", "하락률", "percent"], ["volume", "거래", "count"],
  ]),
  highest_price: columns([
    ["rank", "순위", "rank"], ["propertyName", "단지", "text"], ["buildingDong", "동", "text"],
    ["area", "전용면적·평수", "area"], ["highestAmount", "최고 거래금액", "price"],
    ["highestDate", "계약일", "date"], ["floor", "층", "text"], ["highestPerPyeong", "평당가격", "unit-price"],
  ]),
  top_growth: columns([
    ["rank", "순위", "rank"], ["propertyName", "단지", "text"], ["area", "동·평형", "area"],
    ["currentMedian", "최근 중위가", "price"], ["previousMedian", "직전 중위가", "price"],
    ["changeAmount", "상승 금액", "price"], ["changePct", "상승률", "percent"], ["sample", "비교 표본", "count"],
  ]),
  price_per_pyeong: columns([
    ["rank", "순위", "rank"], ["propertyName", "단지", "text"], ["areaM2", "전용면적 ㎡", "area"],
    ["areaPyeong", "전용면적 환산평", "area"], ["latestAmount", "최근 거래금액", "price"],
    ["medianPerPyeong", "평당가격", "unit-price"], ["regionDelta", "지역 중위값 대비", "percent"], ["latestDate", "계약일", "date"],
  ]),
  price_change: columns([
    ["propertyName", "단지", "text"], ["area", "동·평형", "area"], ["currentMedian", "최근 월·분기 중위가", "price"],
    ["movingMedian", "3개월 이동중위가", "price"], ["changePct", "최근 3개월 변화율", "percent"],
    ["volume", "최근 3개월 거래량", "count"], ["highestAmount", "기간 최고가", "price"], ["lowestAmount", "기간 최저가", "price"],
  ]),
  complex_compare: columns([
    ["propertyName", "단지", "text"], ["area", "선택 평형", "area"], ["currentMedian", "최근 중위가격", "price"],
    ["medianPerPyeong", "평당가격", "unit-price"], ["volume", "최근 3개월 거래량", "count"],
    ["changePct", "직전 분기 대비", "percent"], ["highestAmount", "최고가", "price"], ["sample", "표본 상태", "text"],
  ]),
};

function safeArea(trade: TradeRecord): number | null {
  const value = trade.areaMeasurement.valueM2 ?? trade.area;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function toPyeong(areaM2: number | null): number | null {
  return areaM2 !== null && Number.isFinite(areaM2) && areaM2 > 0 ? areaM2 / M2_PER_PYEONG : null;
}

export function pricePerPyeong(amountManwon: number, areaM2: number | null): number | null {
  const pyeong = toPyeong(areaM2);
  return pyeong ? amountManwon / pyeong : null;
}

export function areaBucket(areaM2: number, bucketSizeM2 = AREA_BUCKET_SIZE_M2): number {
  if (!(bucketSizeM2 > 0) || !Number.isFinite(areaM2)) throw new Error("면적 그룹 기준은 유효한 양수여야 합니다.");
  return Math.round(areaM2 / bucketSizeM2) * bucketSizeM2;
}

function statusFor(count: number, minimumRequired: number, partial: boolean): SampleStatus {
  if (partial) return { state: "partial", count, minimumRequired, reason: "일부 원본 응답을 수집하지 못했습니다." };
  if (!count) return { state: "none", count, minimumRequired, reason: "해당 기간에 신고 거래가 없습니다." };
  if (count < minimumRequired) return { state: "low", count, minimumRequired, reason: `최소 ${minimumRequired}건이 필요합니다.` };
  return { state: "sufficient", count, minimumRequired };
}

function latestTrade(rows: TradeRecord[]) {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] ?? null;
}

function highestTrade(rows: TradeRecord[]) {
  return [...rows].sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))[0] ?? null;
}

function lowestTrade(rows: TradeRecord[]) {
  return [...rows].sort((a, b) => a.amount - b.amount || b.date.localeCompare(a.date))[0] ?? null;
}

function view(metric: ResearchMetric, label: string, description: string, comparisonBasis: string, rowIds: string[]): ResearchView {
  return { metric, label, description, comparisonBasis, columns: VIEW_COLUMNS[metric], rowIds };
}

export function buildResearchBundle(
  inputTrades: TradeRecord[],
  options: {
    from: string;
    to: string;
    anchorMonth?: string;
    minimumSample?: number;
    partialMonths?: ReadonlySet<string>;
    partial?: boolean;
  },
): ResearchBundle {
  const minimumSample = options.minimumSample ?? DEFAULT_RESEARCH_MINIMUM_SAMPLE;
  const partialMonths = options.partialMonths ?? new Set<string>();
  const trades = inputTrades.filter((trade) => !trade.cancelled && trade.date.slice(0, 7) >= options.from && trade.date.slice(0, 7) <= options.to);
  const anchorMonth = options.anchorMonth ?? options.to;
  const validUnitPrices = trades.flatMap((trade) => {
    const unit = pricePerPyeong(trade.amount, safeArea(trade));
    return unit === null ? [] : [unit];
  });
  const regionMedianPerPyeongManwon = median(validUnitPrices);
  const hasRelevantPartial = Boolean(options.partial) || [...partialMonths].some((month) => month >= options.from && month <= options.to);
  const grouped = new Map<string, TradeRecord[]>();
  for (const trade of trades) {
    const area = safeArea(trade);
    if (area === null) continue;
    const bucket = areaBucket(area);
    const key = `${trade.propertyKey}|${trade.areaMeasurement.kind}|${bucket.toFixed(1)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  }

  const trendFrom = options.from > shiftMonth(anchorMonth, -11) ? options.from : shiftMonth(anchorMonth, -11);
  const rows: AreaPriceSummary[] = [...grouped.entries()].map(([id, group]) => {
    const newest = latestTrade(group);
    const highest = highestTrade(group);
    const lowest = lowestTrade(group);
    const representativeAreaM2 = median(group.map((trade) => safeArea(trade) ?? Number.NaN)) ?? areaBucket(safeArea(group[0])!);
    const quarter = rollingQuarter(group, anchorMonth, minimumSample, partialMonths);
    const period = summarize(group, minimumSample, hasRelevantPartial);
    const comparable = quarter.current.sample.state === "sufficient" && quarter.previous.sample.state === "sufficient";
    const currentMedian = quarter.current.medianAmountManwon;
    const previousMedian = quarter.previous.medianAmountManwon;
    const changeAmountManwon = comparable && currentMedian !== null && previousMedian !== null ? currentMedian - previousMedian : null;
    const medianPerPyeongManwon = period.medianPerPyeongManwon;
    const regionDeltaPct = medianPerPyeongManwon !== null && regionMedianPerPyeongManwon && period.sample.state === "sufficient"
      ? (medianPerPyeongManwon / regionMedianPerPyeongManwon - 1) * 100
      : null;
    const convert = (trade: TradeRecord | null) => trade ? {
      date: trade.date,
      amountManwon: trade.amount,
      floor: trade.floor,
      buildingDong: trade.buildingDong,
      pricePerPyeongManwon: pricePerPyeong(trade.amount, safeArea(trade)),
    } : null;
    return {
      id,
      propertyKey: group[0].propertyKey,
      propertyName: group[0].name,
      propertyType: group[0].propertyType,
      dong: group[0].dong,
      jibun: group[0].jibun,
      buildingDongs: [...new Set(group.map((trade) => trade.buildingDong).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")),
      areaKind: group[0].areaMeasurement.kind,
      areaBucketM2: areaBucket(representativeAreaM2),
      representativeAreaM2,
      pyeongEquivalent: toPyeong(representativeAreaM2)!,
      latestTrade: convert(newest),
      highestTrade: convert(highest),
      lowestTrade: convert(lowest),
      period,
      currentQuarter: quarter.current,
      previousQuarter: quarter.previous,
      changeAmountManwon,
      changePct: quarter.changePct,
      regionMedianPerPyeongManwon,
      regionDeltaPct,
      trend: monthlySeries(group, trendFrom, options.to, 2, partialMonths),
      sample: statusFor(group.length, minimumSample, hasRelevantPartial),
    };
  }).sort((a, b) => a.propertyName.localeCompare(b.propertyName, "ko") || a.representativeAreaM2 - b.representativeAreaM2);

  const complexes: ComplexPriceSummary[] = [...new Set(rows.map((row) => row.propertyKey))].map((propertyKey) => {
    const propertyRows = rows.filter((row) => row.propertyKey === propertyKey);
    const propertyTrades = trades.filter((trade) => trade.propertyKey === propertyKey && safeArea(trade) !== null);
    const latest = latestTrade(propertyTrades);
    const isPartial = propertyRows.some((row) => row.sample.state === "partial");
    return {
      propertyKey,
      propertyName: propertyRows[0].propertyName,
      propertyType: propertyRows[0].propertyType,
      dong: propertyRows[0].dong,
      jibun: propertyRows[0].jibun,
      areaSummaryIds: propertyRows.map((row) => row.id).sort((a, b) => (rows.find((row) => row.id === a)?.representativeAreaM2 ?? 0) - (rows.find((row) => row.id === b)?.representativeAreaM2 ?? 0)),
      areaCount: propertyRows.length,
      tradeCount: propertyTrades.length,
      latestTradeDate: latest?.date ?? null,
      medianPerPyeongManwon: median(propertyRows.flatMap((row) => row.period.medianPerPyeongManwon === null ? [] : [row.period.medianPerPyeongManwon])),
      sample: statusFor(propertyTrades.length, minimumSample, isPartial),
    };
  }).sort((a, b) => b.tradeCount - a.tradeCount || a.propertyName.localeCompare(b.propertyName, "ko"));

  const by = (predicate: (row: AreaPriceSummary) => boolean, compare: (a: AreaPriceSummary, b: AreaPriceSummary) => number) =>
    rows.filter(predicate).sort(compare).map((row) => row.id);
  const views: Record<ResearchMetric, ResearchView> = {
    recent_decline: view("recent_decline", "최근 하락", "같은 단지·면적의 최근 분기 중위가격 하락 순위", "최근 3개월과 직전 3개월의 중위가격", by((row) => row.changePct !== null && row.changePct < 0, (a, b) => a.changePct! - b.changePct!)),
    highest_price: view("highest_price", "최고가", "선택 기간에 신고된 단지·면적별 최고 거래", "취소 거래를 제외한 선택 기간 최고 거래금액", by((row) => row.highestTrade !== null, (a, b) => b.highestTrade!.amountManwon - a.highestTrade!.amountManwon)),
    top_growth: view("top_growth", "상승률 상위", "같은 단지·면적의 최근 분기 중위가격 상승 순위", "최근 3개월과 직전 3개월의 충분한 표본", by((row) => row.changePct !== null && row.changePct > 0, (a, b) => b.changePct! - a.changePct!)),
    price_per_pyeong: view("price_per_pyeong", "평당가격", "전용면적 환산평 기준의 단지·면적별 가격", "거래금액 ÷ (전용면적㎡ ÷ 3.305785)", by((row) => row.period.medianPerPyeongManwon !== null, (a, b) => b.period.medianPerPyeongManwon! - a.period.medianPerPyeongManwon!)),
    price_change: view("price_change", "가격 변화", "월 중위가격과 거래량의 단지·면적별 흐름", "최근 분기 중위가격 및 최대 12개월 월 시계열", by(() => true, (a, b) => {
      if (a.changePct === null && b.changePct !== null) return 1;
      if (a.changePct !== null && b.changePct === null) return -1;
      return Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0) || b.currentQuarter.volume - a.currentQuarter.volume;
    })),
    complex_compare: view("complex_compare", "단지 비교", "동일 면적 조건으로 비교할 단지 후보", "단지·전용면적 그룹별 중위가격과 평당가격", by(() => true, (a, b) => b.currentQuarter.volume - a.currentQuarter.volume || a.representativeAreaM2 - b.representativeAreaM2)),
  };
  const status: DataState = hasRelevantPartial ? "partial" : rows.length ? "ok" : "empty";
  return {
    status,
    anchorMonth,
    minimumSample,
    areaBucketSizeM2: AREA_BUCKET_SIZE_M2,
    areaBasis: trades.length && trades.every((trade) => trade.areaMeasurement.kind === "exclusive") ? "exclusive" : "mixed",
    regionMedianPerPyeongManwon,
    rows,
    complexes,
    views,
  };
}
