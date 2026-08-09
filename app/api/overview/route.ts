export const dynamic = "force-dynamic";

const API_ROOT = "https://apis.data.go.kr/1613000";
const SERVICES = {
  apt: ["RTMSDataSvcAptTradeDev", "getRTMSDataSvcAptTradeDev"],
  rowhouse: ["RTMSDataSvcRHTrade", "getRTMSDataSvcRHTrade"],
  house: ["RTMSDataSvcSHTrade", "getRTMSDataSvcSHTrade"],
  officetel: ["RTMSDataSvcOffiTrade", "getRTMSDataSvcOffiTrade"],
  commercial: ["RTMSDataSvcNrgTrade", "getRTMSDataSvcNrgTrade"],
  factory: ["RTMSDataSvcInduTrade", "getRTMSDataSvcInduTrade"],
} as const;
type PropertyType = keyof typeof SERVICES;

const MARKETS = [
  ["서울", "서울특별시", "11680"], ["경기", "경기도", "41135"], ["인천", "인천광역시", "28200"],
  ["부산", "부산광역시", "26350"], ["대구", "대구광역시", "27260"], ["대전", "대전광역시", "30200"],
  ["울산", "울산광역시", "31170"], ["세종", "세종특별자치시", "36110"], ["강원", "강원특별자치도", "51130"],
  ["충북", "충청북도", "43113"], ["충남", "충청남도", "44133"], ["전남광주", "전남광주통합특별시", "12270"],
  ["전북", "전북특별자치도", "52111"], ["경북", "경상북도", "47113"], ["경남", "경상남도", "48121"],
  ["제주", "제주특별자치도", "50110"],
] as const;

function key() {
  const value = process.env.MOLIT_SERVICE_KEY;
  if (!value) throw new Error("국토교통부 API 키가 설정되지 않았습니다.");
  try { return decodeURIComponent(value); } catch { return value; }
}
function monthKey(back: number) { const now = new Date(); const date = new Date(now.getFullYear(), now.getMonth() - back, 1); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`; }
function shiftMonthKey(base: string, offset: number) { const date = new Date(Number(base.slice(0, 4)), Number(base.slice(4)) - 1 + offset, 1); return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
async function fetchMarket(type: PropertyType, code: string, month: string) {
  const [service, operation] = SERVICES[type]; const url = new URL(`${API_ROOT}/${service}/${operation}`);
  for (const [name, value] of Object.entries({ LAWD_CD: code, DEAL_YMD: month, pageNo: "1", numOfRows: "1000", serviceKey: key() })) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { Accept: "application/xml" } }); if (!response.ok) return [];
  const xml = await response.text(); const amounts: number[] = [];
  for (const match of xml.matchAll(/<dealAmount>([\s\S]*?)<\/dealAmount>/g)) { const amount = Number(match[1].replaceAll(",", "").trim()); if (amount) amounts.push(amount); }
  return amounts;
}
async function fetchQuarter(type: PropertyType, code: string, months: string[]) { const rows = await Promise.all(months.map((month) => fetchMarket(type, code, month))); return rows.flat(); }
async function latestAvailableMonth(type: PropertyType) {
  const candidates = Array.from({ length: 36 }, (_, index) => monthKey(index + 1));
  for (let index = 0; index < candidates.length; index += 6) {
    const batch = candidates.slice(index, index + 6); const rows = await Promise.all(batch.map((month) => fetchMarket(type, MARKETS[0][2], month)));
    const found = rows.findIndex((values) => values.length > 0); if (found >= 0) return batch[found];
  }
  return candidates[0];
}

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("type") || "apt";
    if (!(requested in SERVICES)) return Response.json({ error: "지원하지 않는 부동산 유형입니다." }, { status: 400 });
    const type = requested as PropertyType; const latestMonth = await latestAvailableMonth(type); const periods = { current: [0, -1, -2].map((offset) => shiftMonthKey(latestMonth, offset)), previous: [-3, -4, -5].map((offset) => shiftMonthKey(latestMonth, offset)) }; const results = [];
    for (let index = 0; index < MARKETS.length; index += 4) {
      const batch = await Promise.all(MARKETS.slice(index, index + 4).map(async ([short, sido, code]) => {
        const [previous, current] = await Promise.all([fetchQuarter(type, code, periods.previous), fetchQuarter(type, code, periods.current)]); const before = previous.length ? median(previous) : 0; const latest = current.length ? median(current) : 0;
        return { short, sido, code, count: current.length, median: latest, change: previous.length >= 3 && current.length >= 3 && before && latest ? (latest / before - 1) * 100 : 0 };
      })); results.push(...batch);
    }
    return Response.json({ markets: results, month: periods.current[0], previousMonth: periods.previous[0], basis: "rolling-quarter", type }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "전국 시장 데이터를 불러오지 못했습니다." }, { status: 502 }); }
}
