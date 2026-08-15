import { readCache, writeCache, type CacheReadResult } from "../../lib/cache/repository.ts";
import { median } from "../../lib/market/aggregate.ts";
import { fetchAllMolitPages, type MolitCollection, UpstreamDataError } from "../../lib/market/molit.ts";
import { normalizeMolitTrade } from "../../lib/market/normalize.ts";
import type { DataState, PropertyType, RepresentativeMarket, SampleStatus } from "../../lib/market/types";

export const dynamic = "force-dynamic";

type OverviewPayload = {
  markets: RepresentativeMarket[];
  status: DataState;
  meta: { warnings: string[]; [key: string]: unknown };
  [key: string]: unknown;
};

const API_ROOT = "https://apis.data.go.kr/1613000";
const SERVICES: Record<PropertyType, readonly [string, string]> = {
  apt: ["RTMSDataSvcAptTradeDev", "getRTMSDataSvcAptTradeDev"],
  rowhouse: ["RTMSDataSvcRHTrade", "getRTMSDataSvcRHTrade"],
  house: ["RTMSDataSvcSHTrade", "getRTMSDataSvcSHTrade"],
  officetel: ["RTMSDataSvcOffiTrade", "getRTMSDataSvcOffiTrade"],
  commercial: ["RTMSDataSvcNrgTrade", "getRTMSDataSvcNrgTrade"],
  factory: ["RTMSDataSvcInduTrade", "getRTMSDataSvcInduTrade"],
};

const REPRESENTATIVE_DISTRICTS = [
  ["서울", "서울특별시", "11680"], ["경기", "경기도", "41135"], ["인천", "인천광역시", "28200"],
  ["부산", "부산광역시", "26350"], ["대구", "대구광역시", "27260"], ["대전", "대전광역시", "30200"],
  ["울산", "울산광역시", "31170"], ["세종", "세종특별자치시", "36110"], ["강원", "강원특별자치도", "51130"],
  ["충북", "충청북도", "43113"], ["충남", "충청남도", "44133"], ["전남광주", "전남광주통합특별시", "12270"],
  ["전북", "전북특별자치도", "52111"], ["경북", "경상북도", "47113"], ["경남", "경상남도", "48121"],
  ["제주", "제주특별자치도", "50110"],
] as const;

function serviceKey() {
  const value = process.env.MOLIT_SERVICE_KEY;
  if (!value) throw new Error("국토교통부 API 키가 설정되지 않았습니다.");
  try { return decodeURIComponent(value); } catch { return value; }
}

function monthKey(back: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(base: string, offset: number) {
  const date = new Date(Number(base.slice(0, 4)), Number(base.slice(4)) - 1 + offset, 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchMonth(type: PropertyType, code: string, month: string): Promise<MolitCollection> {
  const [service, operation] = SERVICES[type];
  const url = new URL(`${API_ROOT}/${service}/${operation}`);
  for (const [name, value] of Object.entries({ LAWD_CD: code, DEAL_YMD: month, numOfRows: "1000", serviceKey: serviceKey() })) url.searchParams.set(name, value);
  return fetchAllMolitPages(url);
}

function activeAmounts(collection: MolitCollection, type: PropertyType) {
  return collection.rows.map((row, index) => normalizeMolitTrade(row, type, index)).flatMap((trade) => trade && !trade.cancelled ? [trade.amount] : []);
}

async function fetchPeriod(type: PropertyType, code: string, months: string[]) {
  const settled = await Promise.allSettled(months.map((month) => fetchMonth(type, code, month)));
  const amounts: number[] = [];
  const warnings: string[] = [];
  let fetchedPages = 0;
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      warnings.push(`${months[index]} 월을 수집하지 못했습니다.`);
      return;
    }
    amounts.push(...activeAmounts(result.value, type));
    fetchedPages += result.value.fetchedPages;
    warnings.push(...result.value.warnings.map((warning) => `${months[index]}: ${warning}`));
  });
  return { amounts, fetchedPages, warnings, partial: warnings.length > 0, successfulMonths: settled.filter((result) => result.status === "fulfilled").length };
}

async function latestAvailableMonth(type: PropertyType) {
  const candidates = Array.from({ length: 36 }, (_, index) => monthKey(index + 1));
  for (let index = 0; index < candidates.length; index += 6) {
    const batch = candidates.slice(index, index + 6);
    const settled = await Promise.allSettled(batch.map((month) => fetchMonth(type, REPRESENTATIVE_DISTRICTS[0][2], month)));
    const found = settled.findIndex((result) => result.status === "fulfilled" && activeAmounts(result.value, type).length > 0);
    if (found >= 0) return batch[found];
  }
  throw new UpstreamDataError("최근 실거래 기준 월을 찾지 못했습니다.", "empty");
}

function sample(count: number, partial: boolean, minimumRequired = 3): SampleStatus {
  if (partial) return { state: "partial", count, minimumRequired, reason: "일부 원본 응답을 수집하지 못했습니다." };
  if (count === 0) return { state: "none", count, minimumRequired };
  if (count < minimumRequired) return { state: "low", count, minimumRequired };
  return { state: "sufficient", count, minimumRequired };
}

export async function GET(request: Request) {
  let cached: CacheReadResult<OverviewPayload> | null = null;
  try {
    const params = new URL(request.url).searchParams;
    const requested = params.get("type") || "apt";
    if (!(requested in SERVICES)) return Response.json({ error: "지원하지 않는 부동산 유형입니다." }, { status: 400 });
    const type = requested as PropertyType;
    const basis = (params.get("basis") || "rolling-quarter").slice(0, 40);
    const cacheKey = { propertyType: type, basis };
    cached = await readCache<OverviewPayload>("market-overview", cacheKey, { allowStale: true });
    if (cached.state === "fresh" && cached.data) {
      return Response.json({
        ...cached.data,
        meta: { ...cached.data.meta, cache: { state: "fresh", capturedAt: cached.capturedAt } },
      }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
    }
    const latestMonth = await latestAvailableMonth(type);
    const periods = {
      current: [0, -1, -2].map((offset) => shiftMonthKey(latestMonth, offset)),
      previous: [-3, -4, -5].map((offset) => shiftMonthKey(latestMonth, offset)),
    };
    const markets: RepresentativeMarket[] = [];
    const warnings: string[] = [];
    let fetchedPages = 0;

    for (let index = 0; index < REPRESENTATIVE_DISTRICTS.length; index += 4) {
      const batch = await Promise.all(REPRESENTATIVE_DISTRICTS.slice(index, index + 4).map(async ([short, sido, code]) => {
        const [previous, current] = await Promise.all([fetchPeriod(type, code, periods.previous), fetchPeriod(type, code, periods.current)]);
        const before = median(previous.amounts);
        const latest = median(current.amounts);
        const isPartial = previous.partial || current.partial;
        const currentSample = sample(current.amounts.length, isPartial);
        const previousSample = sample(previous.amounts.length, isPartial);
        const comparable = currentSample.state === "sufficient" && previousSample.state === "sufficient";
        const changePct = comparable && before && latest !== null ? (latest / before - 1) * 100 : null;
        const status: DataState = isPartial ? "partial" : current.amounts.length ? "ok" : "empty";
        return {
          market: {
            short, sido, code,
            count: current.amounts.length,
            median: latest ?? 0,
            change: changePct ?? 0,
            medianAmountManwon: latest,
            changePct,
            sample: currentSample,
            status,
          } satisfies RepresentativeMarket,
          warnings: [...previous.warnings, ...current.warnings].map((warning) => `${code}: ${warning}`),
          fetchedPages: previous.fetchedPages + current.fetchedPages,
        };
      }));
      batch.forEach((result) => {
        markets.push(result.market);
        warnings.push(...result.warnings);
        fetchedPages += result.fetchedPages;
      });
    }
    const status: DataState = warnings.length ? "partial" : markets.some((market) => market.count > 0) ? "ok" : "empty";
    const payload: OverviewPayload = {
      markets,
      month: periods.current[0],
      previousMonth: periods.previous[0],
      basis: "rolling-quarter",
      type,
      status,
      source: "국토교통부 실거래가 공개시스템",
      meta: {
        scope: {
          kind: "representative-districts",
          nationwide: false,
          label: "16개 대표 시군구 표본",
          regionCount: REPRESENTATIVE_DISTRICTS.length,
          districts: REPRESENTATIVE_DISTRICTS.map(([short, sido, code]) => ({ short, sido, code })),
        },
        periods,
        fetchedPages,
        warnings,
        cache: { state: cached.state, capturedAt: null },
      },
    };
    if (status === "ok" || status === "empty") {
      await writeCache("market-overview", cacheKey, payload, {
        freshForSeconds: 24 * 60 * 60,
        staleForSeconds: 7 * 24 * 60 * 60,
        dataStatus: status,
      });
    }
    return Response.json(payload, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch (error) {
    if (cached?.state === "stale" && cached.data) {
      return Response.json({
        ...cached.data,
        status: "partial",
        meta: {
          ...cached.data.meta,
          warnings: [...(cached.data.meta.warnings || []), `최신 대표 지역 집계를 갱신하지 못해 ${cached.capturedAt ?? "이전 수집 시점"}의 캐시를 표시합니다.`],
          cache: { state: "stale", capturedAt: cached.capturedAt, fallback: true },
        },
      }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
    }
    const message = error instanceof Error ? error.message : "대표 지역 시장 데이터를 불러오지 못했습니다.";
    const status = error instanceof UpstreamDataError && error.kind === "timeout" ? 504 : 502;
    return Response.json({ error: message }, { status });
  }
}
