import { combineDataState, monthlySeries, rollingQuarter } from "../../lib/market/aggregate.ts";
import { fetchAllMolitPages, type MolitCollection, UpstreamDataError } from "../../lib/market/molit.ts";
import { normalizeMolitTrade } from "../../lib/market/normalize.ts";
import type { PropertySummary, PropertyType, TradeRecord, TradesResponse } from "../../lib/market/types";

export const dynamic = "force-dynamic";

const API_ROOT = "https://apis.data.go.kr/1613000";
const SERVICES: Record<PropertyType, readonly [string, string]> = {
  apt: ["RTMSDataSvcAptTradeDev", "getRTMSDataSvcAptTradeDev"],
  rowhouse: ["RTMSDataSvcRHTrade", "getRTMSDataSvcRHTrade"],
  house: ["RTMSDataSvcSHTrade", "getRTMSDataSvcSHTrade"],
  officetel: ["RTMSDataSvcOffiTrade", "getRTMSDataSvcOffiTrade"],
  commercial: ["RTMSDataSvcNrgTrade", "getRTMSDataSvcNrgTrade"],
  factory: ["RTMSDataSvcInduTrade", "getRTMSDataSvcInduTrade"],
};

function serviceKey() {
  const value = process.env.MOLIT_SERVICE_KEY;
  if (!value) throw new Error("국토교통부 API 키가 설정되지 않았습니다.");
  try { return decodeURIComponent(value); } catch { return value; }
}

function numeric(value = "") {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthIds(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  }).reverse();
}

function displayMonth(month: string) {
  return `${month.slice(0, 4)}-${month.slice(4)}`;
}

async function fetchMonth(type: PropertyType, lawd: string, month: string): Promise<MolitCollection> {
  const [service, operation] = SERVICES[type];
  const url = new URL(`${API_ROOT}/${service}/${operation}`);
  url.searchParams.set("LAWD_CD", lawd);
  url.searchParams.set("DEAL_YMD", month);
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("serviceKey", serviceKey());
  return fetchAllMolitPages(url);
}

async function fetchMonths(type: PropertyType, lawd: string, months: string[]) {
  const collections = new Map<string, MolitCollection>();
  const failures = new Map<string, unknown>();
  for (let index = 0; index < months.length; index += 6) {
    const batchMonths = months.slice(index, index + 6);
    const settled = await Promise.allSettled(batchMonths.map((month) => fetchMonth(type, lawd, month)));
    settled.forEach((result, resultIndex) => {
      const month = batchMonths[resultIndex];
      if (result.status === "fulfilled") collections.set(month, result.value);
      else failures.set(month, result.reason);
    });
  }
  if (!collections.size && failures.size) throw failures.values().next().value;
  return { collections, failures };
}

function propertySummaries(trades: TradeRecord[]): PropertySummary[] {
  const properties = new Map<string, PropertySummary & { areaSet: Set<number>; areaKindSet: Set<TradeRecord["areaMeasurement"]["kind"]> }>();
  for (const trade of trades) {
    const current = properties.get(trade.propertyKey) ?? {
      key: trade.propertyKey,
      name: trade.name,
      dong: trade.dong,
      jibun: trade.jibun,
      count: 0,
      lastAmount: 0,
      areas: [],
      areaKinds: [],
      areaSet: new Set<number>(),
      areaKindSet: new Set<TradeRecord["areaMeasurement"]["kind"]>(),
    };
    current.count += 1;
    current.lastAmount = trade.amount;
    if (trade.area > 0) current.areaSet.add(Math.round(trade.area * 10) / 10);
    current.areaKindSet.add(trade.areaMeasurement.kind);
    properties.set(trade.propertyKey, current);
  }
  return [...properties.values()].map(({ areaSet, areaKindSet, ...property }) => ({
    ...property,
    areas: [...areaSet].sort((a, b) => a - b),
    areaKinds: [...areaKindSet],
  })).sort((a, b) => b.count - a.count);
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const requestedType = params.get("type") || "apt";
    if (!(requestedType in SERVICES)) return Response.json({ error: "지원하지 않는 부동산 유형입니다." }, { status: 400 });
    const type = requestedType as PropertyType;
    const lawd = (params.get("lawd") || "11680").replace(/\D/g, "").slice(0, 5);
    if (lawd.length !== 5) return Response.json({ error: "시군구 코드를 확인해주세요." }, { status: 400 });
    const monthCount = Math.min(60, Math.max(3, numeric(params.get("months") || "12")));
    const requestedMonths = monthIds(monthCount);
    const query = (params.get("query") || "").trim().toLocaleLowerCase("ko");
    const exact = params.get("exact") === "1";
    const { collections, failures } = await fetchMonths(type, lawd, requestedMonths);
    const partialMonthIds = [
      ...failures.keys(),
      ...[...collections].filter(([, collection]) => collection.partial).map(([month]) => month),
    ];
    const partialMonths = new Set<string>(partialMonthIds.map(displayMonth));
    const rawRows = [...collections.values()].flatMap((collection) => collection.rows);
    const normalized = rawRows.map((row, index) => normalizeMolitTrade(row, type, index));
    const invalidRows = normalized.filter((trade) => trade === null).length;
    const cancelledRows = normalized.filter((trade) => trade?.cancelled).length;
    let trades = normalized.filter((trade): trade is TradeRecord => Boolean(trade && !trade.cancelled));
    if (query) {
      trades = trades.filter((trade) => {
        const haystack = `${trade.name} ${trade.dong} ${trade.buildingDong} ${trade.jibun}`.toLocaleLowerCase("ko");
        return exact ? trade.propertyKey.toLocaleLowerCase("ko") === query : haystack.includes(query);
      });
    }
    trades.sort((a, b) => a.date.localeCompare(b.date));

    const successfulMonths = [...collections.keys()];
    const failedMonths = [...failures.keys()];
    const fetchedPages = [...collections.values()].reduce((sum, collection) => sum + collection.fetchedPages, 0);
    const totalCount = [...collections.values()].reduce((sum, collection) => sum + collection.totalCount, 0);
    const warnings = [
      ...[...collections].flatMap(([month, collection]) => collection.warnings.map((warning) => `${month}: ${warning}`)),
      ...failedMonths.map((month) => `${month}: 해당 월을 수집하지 못했습니다.`),
      ...(invalidRows ? [`필수 필드가 잘못된 ${invalidRows}건을 제외했습니다.`] : []),
      ...(cancelledRows ? [`취소 신고 ${cancelledRows}건을 제외했습니다.`] : []),
    ];
    const status = combineDataState(successfulMonths.length, failedMonths.length + [...collections.values()].filter((collection) => collection.partial).length, trades.length);
    const from = displayMonth(requestedMonths[0]);
    const to = displayMonth(requestedMonths.at(-1)!);
    const response: TradesResponse = {
      trades,
      properties: propertySummaries(trades),
      months: monthCount,
      lawd,
      type,
      source: "국토교통부 실거래가 공개시스템",
      status,
      aggregates: {
        monthly: monthlySeries(trades, from, to, 2, partialMonths),
        rollingQuarter: rollingQuarter(trades, to, 3, partialMonths),
      },
      meta: {
        requestedMonths,
        successfulMonths,
        failedMonths,
        fetchedPages,
        totalCount,
        warnings,
        areaKinds: [...new Set(trades.map((trade) => trade.areaMeasurement.kind))],
        period: { from, to, basis: "calendar-month", completeness: "provisional" },
      },
    };
    return Response.json(response, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "실거래가를 불러오지 못했습니다.";
    const status = error instanceof UpstreamDataError && error.kind === "timeout" ? 504 : 502;
    return Response.json({ error: message }, { status });
  }
}
